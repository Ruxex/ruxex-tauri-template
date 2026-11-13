use std::sync::Arc;

use ruxex::arg0::{Arg0DispatchPaths, Arg0PathEntryGuard};
use ruxex::desktop::config::LoaderOverrides;
use ruxex::desktop::core::{
    self,
    config::{Config, ConfigOverrides},
};
use ruxex::desktop::utils::absolute_path::AbsolutePathBuf;
use ruxex::desktop::{
    app_server_control_socket_path,
    client::{
        AppServerClient, AppServerEvent, AppServerRequestHandle,
        DEFAULT_IN_PROCESS_CHANNEL_CAPACITY, EnvironmentManager, ExecServerRuntimePaths,
        InProcessAppServerClient, InProcessClientStartArgs, RemoteAppServerClient,
        RemoteAppServerConnectArgs, RemoteAppServerEndpoint,
        provider_init_from_config_with_descriptor,
    },
    daemon::{HOST_APP_SERVER_DAEMON_MODE_ARG, LifecycleCommand, LifecycleOutput, LifecycleStatus},
    protocol::{
        ClientRequest, ClientResponse, ConfigWarningNotification, JSONRPCErrorError, RequestId,
        Result as JsonRpcResult,
    },
};
use ruxex::protocol::protocol::SessionSource;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::scheduler_app_server::{AppServerLogDirection, log_app_server_io};

mod connection;
mod daemon;
use self::connection::{clear_connection_state, connect_local_endpoint, install_connection};
use self::daemon::*;

use crate::desktop::ruxex_home;
use crate::desktop_config::DesktopConfig;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};

const DESKTOP_EXPERIMENTAL_API: bool = true;
const APP_SERVER_MODE_ENV_VAR: &str = "RUXEX_APP_SERVER_MODE";

pub(crate) struct AppServerState {
    initialization: tauri::async_runtime::Mutex<()>,
    request_handle: tauri::async_runtime::Mutex<Option<AppServerRequestHandle>>,
    status: tauri::async_runtime::Mutex<Option<AppServerStatus>>,
    shutdown: tauri::async_runtime::Mutex<Option<tauri::async_runtime::Sender<()>>>,
    arg0_paths: Arg0DispatchPaths,
    _arg0_path_guard: Option<Arg0PathEntryGuard>,
    config: DesktopConfig,
}

impl AppServerState {
    pub(crate) fn with_arg0_paths(
        arg0_paths: Arg0DispatchPaths,
        arg0_path_guard: Option<Arg0PathEntryGuard>,
        config: DesktopConfig,
    ) -> Self {
        Self {
            initialization: tauri::async_runtime::Mutex::new(()),
            request_handle: tauri::async_runtime::Mutex::new(None),
            status: tauri::async_runtime::Mutex::new(None),
            shutdown: tauri::async_runtime::Mutex::new(None),
            arg0_paths,
            _arg0_path_guard: arg0_path_guard,
            config,
        }
    }
}

impl Default for AppServerState {
    fn default() -> Self {
        Self::with_arg0_paths(
            Arg0DispatchPaths::default(),
            None,
            crate::desktop_config::default_config(),
        )
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppServerStatus {
    socket_path: String,
    home_data_dir: String,
    app_server_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mode: Option<AppServerMode>,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum AppServerMode {
    Daemon,
    InProcess,
}

fn parse_app_server_mode(value: Option<&str>) -> Result<AppServerMode, String> {
    match value.unwrap_or("daemon") {
        "daemon" => Ok(AppServerMode::Daemon),
        "inprocess" => Ok(AppServerMode::InProcess),
        value => Err(format!(
            "unsupported {APP_SERVER_MODE_ENV_VAR} value `{value}`; expected `daemon` or `inprocess`"
        )),
    }
}

fn configured_app_server_mode() -> CommandResult<AppServerMode> {
    parse_app_server_mode(std::env::var(APP_SERVER_MODE_ENV_VAR).ok().as_deref())
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))
}

fn resolve_in_process_paths(
    arg0_paths: &Arg0DispatchPaths,
) -> CommandResult<(std::path::PathBuf, ExecServerRuntimePaths)> {
    let executable = arg0_paths.ruxex_self_exe.clone().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "failed to resolve the desktop executable for in-process App Server helpers",
        )
    })?;
    let runtime_paths = ExecServerRuntimePaths::new(
        executable.clone(),
        arg0_paths.ruxex_linux_sandbox_exe.clone(),
    )
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to initialize in-process execution paths: {error}"),
        )
    })?;
    Ok((executable, runtime_paths))
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AppServerDaemonAction {
    Start,
    Restart,
    Stop,
    ForceStop,
    Version,
}

#[derive(Deserialize)]
struct AppServerPidRecord {
    pid: u32,
}

impl AppServerDaemonAction {
    fn to_lifecycle_command(self) -> LifecycleCommand {
        match self {
            Self::Start => LifecycleCommand::Start,
            Self::Restart => LifecycleCommand::Restart,
            Self::Stop => LifecycleCommand::Stop,
            Self::Version => LifecycleCommand::Version,
            Self::ForceStop => unreachable!("force stop is not a daemon lifecycle command"),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
enum DesktopAppServerEvent {
    Lagged { skipped: usize },
    ServerNotification(Value),
    ServerRequest(Value),
    Disconnected { message: String },
}

fn desktop_skill_policy_request(
    name: &str,
    index: usize,
) -> Result<ClientRequest, serde_json::Error> {
    serde_json::from_value(serde_json::json!({
        "method": "skills/config/write",
        "id": format!("desktop-skill-policy-{index}"),
        "params": {"name": name, "enabled": false}
    }))
}

fn effective_desktop_skill_policy_state(response: &Value) -> Option<bool> {
    response.get("effectiveEnabled").and_then(Value::as_bool)
}

async fn apply_desktop_skill_policy(
    client: &AppServerClient,
    config: &DesktopConfig,
) -> anyhow::Result<()> {
    for (index, name) in config
        .skill_policy
        .ui_policy()
        .hidden_skills
        .iter()
        .enumerate()
    {
        let request = desktop_skill_policy_request(name, index)?;
        let response = client
            .request_typed::<Value>(request)
            .await
            .map_err(|error| anyhow::Error::msg(error.to_string()))?;
        if effective_desktop_skill_policy_state(&response) != Some(false) {
            anyhow::bail!("App Server did not apply Skill `{name}` as disabled");
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn app_server_daemon_control(
    state: State<'_, AppServerState>,
    action: AppServerDaemonAction,
) -> CommandResult<LifecycleOutput> {
    let _initialization = state.initialization.lock().await;
    let status = state.status.lock().await.clone();
    if status
        .as_ref()
        .is_some_and(|status| status.mode == Some(AppServerMode::InProcess))
        || (status.is_none() && configured_app_server_mode()? == AppServerMode::InProcess)
    {
        return Err(command_error(
            DesktopAppServerErrorKind::Lifecycle,
            "App Server daemon controls are unavailable in InProcess mode",
        ));
    }
    if action != AppServerDaemonAction::Version {
        clear_connection_state(&state).await;
    }

    if action == AppServerDaemonAction::ForceStop {
        return force_stop_app_server_daemon().await;
    }

    #[cfg(unix)]
    if matches!(
        action,
        AppServerDaemonAction::Start | AppServerDaemonAction::Stop | AppServerDaemonAction::Restart
    ) {
        if let Some(probe) = probe_physical_residual_daemon(&state.config).await? {
            match action {
                AppServerDaemonAction::Start => {
                    return Ok(recovered_daemon_output(
                        LifecycleStatus::AlreadyRunning,
                        &probe,
                    ));
                }
                AppServerDaemonAction::Stop => {
                    stop_recovered_daemon(&probe).await?;
                    return Ok(recovered_daemon_output(LifecycleStatus::Stopped, &probe));
                }
                AppServerDaemonAction::Restart => {
                    stop_recovered_daemon(&probe).await?;
                    let output = run_desktop_app_server_lifecycle(LifecycleCommand::Start)
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Lifecycle,
                                format!("AppServer daemon restart failed: {error:#}"),
                            )
                        })?;
                    return Ok(output);
                }
                _ => unreachable!("physical residual probe is limited to lifecycle actions"),
            }
        }
    }

    if action == AppServerDaemonAction::Version {
        return match run_desktop_app_server_lifecycle(LifecycleCommand::Version).await {
            Ok(output) => Ok(output),
            Err(error) => version_from_client(&state.config, error).await,
        };
    }

    let command = action.to_lifecycle_command();
    let output = run_desktop_app_server_lifecycle(command).await;

    output.map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("AppServer daemon {action:?} failed: {error:#}"),
        )
    })
}

#[tauri::command]
pub(crate) async fn ensure_app_server(
    app: AppHandle,
    state: State<'_, AppServerState>,
) -> CommandResult<AppServerStatus> {
    let _initialization = state.initialization.lock().await;
    if let Some(status) = state.status.lock().await.clone() {
        return Ok(status);
    }
    let (client, status) = connect_local_endpoint(state.arg0_paths.clone(), &state.config).await?;
    install_connection(&app, &state, client, status).await
}

#[tauri::command]
pub(crate) async fn app_server_request(
    state: State<'_, AppServerState>,
    request: ClientRequest,
) -> CommandResult<ClientResponse> {
    let request_handle = request_handle(&state).await?;
    let method = request.method_name();
    let request_id = request.id().clone();
    log_app_server_io(AppServerLogDirection::ToAppServer, &request);
    let result = match request_handle.request(request).await {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => {
            let message = format!("{method} failed: {} (code {})", error.message, error.code);
            log_app_server_io(
                AppServerLogDirection::FromAppServer,
                &serde_json::json!({
                    "method": method,
                    "id": request_id,
                    "error": { "message": error.message, "code": error.code },
                }),
            );
            return Err(command_error(DesktopAppServerErrorKind::Server, message));
        }
        Err(error) => {
            let message = format!("{method} transport error: {error}");
            log_app_server_io(
                AppServerLogDirection::FromAppServer,
                &serde_json::json!({
                    "method": method,
                    "id": request_id,
                    "error": { "kind": "transport", "message": message },
                }),
            );
            return Err(command_error(DesktopAppServerErrorKind::Transport, message));
        }
    };

    let response = serde_json::json!({
        "method": method,
        "id": request_id,
        "response": result,
    });
    log_app_server_io(AppServerLogDirection::FromAppServer, &response);
    serde_json::from_value(response).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("{method} response decode error: {error}"),
        )
    })
}

#[tauri::command]
pub(crate) async fn app_server_resolve_server_request(
    state: State<'_, AppServerState>,
    request_id: RequestId,
    result: JsonRpcResult,
) -> CommandResult<()> {
    let request_handle = request_handle(&state).await?;
    log_app_server_io(
        AppServerLogDirection::ToAppServer,
        &serde_json::json!({ "id": &request_id, "result": &result }),
    );
    request_handle
        .resolve_server_request(request_id, result)
        .await
        .map_err(|error| command_error(DesktopAppServerErrorKind::Transport, error.to_string()))?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn app_server_reject_server_request(
    state: State<'_, AppServerState>,
    request_id: RequestId,
    error: JSONRPCErrorError,
) -> CommandResult<()> {
    let request_handle = request_handle(&state).await?;
    log_app_server_io(
        AppServerLogDirection::ToAppServer,
        &serde_json::json!({ "id": &request_id, "error": &error }),
    );
    request_handle
        .reject_server_request(request_id, error)
        .await
        .map_err(|error| command_error(DesktopAppServerErrorKind::Transport, error.to_string()))?;
    Ok(())
}

pub(crate) async fn request_handle(
    state: &State<'_, AppServerState>,
) -> CommandResult<AppServerRequestHandle> {
    state.request_handle.lock().await.clone().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Connection,
            "app-server is not connected",
        )
    })
}

#[cfg(test)]
mod tests {
    use std::ffi::OsString;

    use ruxex::arg0::Arg0DispatchPaths;
    use serde_json::json;

    use super::{
        AppServerDaemonAction, AppServerMode, AppServerStatus, DESKTOP_EXPERIMENTAL_API,
        DesktopAppServerEvent, HOST_APP_SERVER_DAEMON_MODE_ARG, desktop_app_server_daemon_args,
        parse_app_server_mode, resolve_in_process_paths,
    };

    #[cfg(unix)]
    #[test]
    fn client_physical_socket_path_survives_data_home_removal() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-client-socket-path-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock should be after the Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(home.join("app-server-control"))
            .expect("data home should be created");
        let before = super::client_physical_socket_path(&home).expect("physical socket path");
        std::fs::remove_dir_all(&home).expect("data home should be removed");
        let after = super::client_physical_socket_path(&home).expect("physical socket path");

        assert_eq!(before, after);
        assert!(!after.starts_with(&home));
        assert_eq!(
            after
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::len),
            Some(64)
        );
    }

    #[cfg(unix)]
    #[test]
    fn client_socket_candidates_keep_logical_socket_before_physical_socket() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-client-socket-candidates-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock should be after the Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&home).expect("data home should be created");

        let candidates = super::client_socket_candidates(&home).expect("socket candidates");
        let logical =
            ruxex::desktop::app_server_control_socket_path(&home).expect("logical socket path");

        assert_eq!(candidates.first(), Some(&logical));
        assert_eq!(candidates.len(), 2);
        assert_ne!(candidates[0], candidates[1]);

        std::fs::remove_dir_all(&home).expect("test home should be removed");
    }

    #[cfg(feature = "example")]
    use super::connection::initialize_in_process_runtime;

    #[test]
    fn desktop_app_server_daemon_args_use_the_desktop_host_mode() {
        let args = desktop_app_server_daemon_args();
        assert_eq!(
            args.as_slice(),
            [
                OsString::from(HOST_APP_SERVER_DAEMON_MODE_ARG),
                OsString::from("--managed-daemon"),
            ]
            .as_slice()
        );
    }

    #[test]
    fn app_server_mode_defaults_to_daemon() {
        assert_eq!(parse_app_server_mode(None).unwrap(), AppServerMode::Daemon);
        assert_eq!(
            parse_app_server_mode(Some("daemon")).unwrap(),
            AppServerMode::Daemon
        );
        assert_eq!(
            parse_app_server_mode(Some("inprocess")).unwrap(),
            AppServerMode::InProcess
        );
    }

    #[test]
    fn app_server_mode_rejects_unknown_values() {
        let error = parse_app_server_mode(Some("invalid")).unwrap_err();
        assert!(error.contains("RUXEX_APP_SERVER_MODE"));
        assert!(error.contains("daemon"));
        assert!(error.contains("inprocess"));
    }

    #[test]
    fn in_process_paths_include_the_sandbox_helper() {
        let paths = Arg0DispatchPaths {
            ruxex_self_exe: Some("/tmp/ruxex-desktop".into()),
            ruxex_linux_sandbox_exe: Some("/tmp/ruxex-linux-sandbox".into()),
        };
        let (executable, runtime_paths) = resolve_in_process_paths(&paths).unwrap();

        assert_eq!(executable, std::path::PathBuf::from("/tmp/ruxex-desktop"));
        assert_eq!(
            runtime_paths
                .ruxex_linux_sandbox_exe
                .as_ref()
                .map(|path| path.display().to_string()),
            Some("/tmp/ruxex-linux-sandbox".to_string())
        );
    }

    #[test]
    fn desktop_connects_with_experimental_protocol_capability() {
        assert!(DESKTOP_EXPERIMENTAL_API);
    }

    #[test]
    fn desktop_skill_policy_request_disables_by_name_without_replacing_other_rules() {
        let request = super::desktop_skill_policy_request("imagegen", 0)
            .expect("desktop skill policy request should serialize");
        assert_eq!(
            serde_json::to_value(request).unwrap(),
            serde_json::json!({
                "method": "skills/config/write",
                "id": "desktop-skill-policy-0",
                "params": {"path": null, "name": "imagegen", "enabled": false}
            })
        );
    }

    #[cfg(feature = "example")]
    #[tokio::test]
    async fn cloudflare_in_process_runtime_uses_the_injected_marker() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-desktop-marker-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock should be after the Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir(&home).expect("test home should be created");
        let result = async {
            let config =
                ruxex::desktop::core::Config::load_default_with_cli_overrides_for_ruxex_home(
                    home.clone(),
                    Vec::new(),
                )
                .await
                .expect("test config should load");
            let desktop_config = crate::desktop_config::example_provider_config(Some("cloudflare"));
            ruxex::provider::mount_provider_home(
                &config.ruxex_home,
                desktop_config.product_identity().home_marker_file(),
                &desktop_config.provider_factory.1,
            )
            .expect("Cloudflare marker should initialize");

            let runtime = initialize_in_process_runtime(&config, &desktop_config)
                .await
                .expect("in-process provider runtime should initialize");
            assert_eq!(runtime.provider_descriptor().provider_kind, "cloudflare");
        }
        .await;
        std::fs::remove_dir_all(&home).expect("test home should be removed");
        result
    }

    #[test]
    fn desktop_skill_policy_requires_an_effective_disabled_response() {
        let response = serde_json::json!({"effectiveEnabled": false});
        assert_eq!(
            super::effective_desktop_skill_policy_state(&response),
            Some(false)
        );

        let response = serde_json::json!({"effectiveEnabled": true});
        assert_eq!(
            super::effective_desktop_skill_policy_state(&response),
            Some(true)
        );
        assert_eq!(
            super::effective_desktop_skill_policy_state(&serde_json::json!({})),
            None
        );
    }

    #[test]
    fn daemon_actions_map_to_lifecycle_commands() {
        assert_eq!(
            AppServerDaemonAction::Start.to_lifecycle_command(),
            ruxex::desktop::daemon::LifecycleCommand::Start
        );
        assert_eq!(
            AppServerDaemonAction::Restart.to_lifecycle_command(),
            ruxex::desktop::daemon::LifecycleCommand::Restart
        );
        assert_eq!(
            AppServerDaemonAction::Stop.to_lifecycle_command(),
            ruxex::desktop::daemon::LifecycleCommand::Stop
        );
        assert_eq!(
            AppServerDaemonAction::Version.to_lifecycle_command(),
            ruxex::desktop::daemon::LifecycleCommand::Version
        );
    }

    #[test]
    fn daemon_actions_use_camel_case_wire_names() {
        for (wire_name, expected) in [
            ("start", AppServerDaemonAction::Start),
            ("restart", AppServerDaemonAction::Restart),
            ("stop", AppServerDaemonAction::Stop),
            ("forceStop", AppServerDaemonAction::ForceStop),
            ("version", AppServerDaemonAction::Version),
        ] {
            let decoded: AppServerDaemonAction = serde_json::from_value(json!(wire_name)).unwrap();
            assert_eq!(decoded, expected);
        }
    }

    #[test]
    fn app_server_events_keep_the_tauri_payload_contract() {
        let lagged = DesktopAppServerEvent::Lagged { skipped: 4 };
        let notification = DesktopAppServerEvent::ServerNotification(json!({
            "method": "thread/status/changed",
            "params": { "threadId": "thread-1" },
        }));

        assert_eq!(
            serde_json::to_value(lagged).unwrap(),
            json!({ "type": "lagged", "data": { "skipped": 4 } })
        );
        assert_eq!(
            serde_json::to_value(notification).unwrap(),
            json!({
                "type": "serverNotification",
                "data": {
                    "method": "thread/status/changed",
                    "params": { "threadId": "thread-1" },
                },
            })
        );
    }

    #[test]
    fn app_server_status_keeps_the_local_bridge_contract() {
        let status = AppServerStatus {
            socket_path: "/tmp/app-server.sock".to_string(),
            home_data_dir: "/home/test-user/.ruxex_desktop".to_string(),
            app_server_version: "local".to_string(),
            mode: Some(AppServerMode::InProcess),
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "socketPath": "/tmp/app-server.sock",
                "homeDataDir": "/home/test-user/.ruxex_desktop",
                "appServerVersion": "local",
                "mode": "inprocess",
            })
        );
    }
}
