use std::ffi::OsString;
use std::sync::Arc;

#[cfg(not(feature = "example"))]
use ruxex::ModelProviderFactory;
use ruxex::app_server::app_server_control_socket_path;
use ruxex_app_server_client::{
    AppServerClient, AppServerEvent, AppServerRequestHandle, InProcessAppServerClient,
    InProcessClientStartArgs, RemoteAppServerClient, RemoteAppServerConnectArgs,
    RemoteAppServerEndpoint,
};
use ruxex_app_server_protocol::{
    ClientRequest, ClientResponse, ConfigWarningNotification, JSONRPCErrorError, RequestId,
    Result as JsonRpcResult,
};
use ruxex_arg0::Arg0DispatchPaths;
use ruxex_config::LoaderOverrides;
use ruxex_core::config::{Config, ConfigOverrides};
use ruxex_protocol::protocol::SessionSource;
use ruxex_utils_absolute_path::AbsolutePathBuf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use ruxex_scheduler::{AppServerLogDirection, log_app_server_io};

use crate::desktop::{product_identity, ruxex_home};
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

const DESKTOP_EXPERIMENTAL_API: bool = true;
const APP_SERVER_MODE_ENV_VAR: &str = "RUXEX_APP_SERVER_MODE";

pub(crate) struct AppServerState {
    initialization: tauri::async_runtime::Mutex<()>,
    request_handle: tauri::async_runtime::Mutex<Option<AppServerRequestHandle>>,
    status: tauri::async_runtime::Mutex<Option<AppServerStatus>>,
    shutdown: tauri::async_runtime::Mutex<Option<tauri::async_runtime::Sender<()>>>,
    arg0_paths: Arg0DispatchPaths,
    _arg0_path_guard: Option<ruxex_arg0::Arg0PathEntryGuard>,
}

impl AppServerState {
    pub(crate) fn with_arg0_paths(
        arg0_paths: Arg0DispatchPaths,
        arg0_path_guard: Option<ruxex_arg0::Arg0PathEntryGuard>,
    ) -> Self {
        Self {
            initialization: tauri::async_runtime::Mutex::new(()),
            request_handle: tauri::async_runtime::Mutex::new(None),
            status: tauri::async_runtime::Mutex::new(None),
            shutdown: tauri::async_runtime::Mutex::new(None),
            arg0_paths,
            _arg0_path_guard: arg0_path_guard,
        }
    }
}

impl Default for AppServerState {
    fn default() -> Self {
        Self::with_arg0_paths(Arg0DispatchPaths::default(), None)
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppServerStatus {
    socket_path: String,
    app_server_version: String,
    endpoint_kind: AppServerEndpointKind,
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
) -> CommandResult<(
    std::path::PathBuf,
    ruxex_app_server_client::ExecServerRuntimePaths,
)> {
    let executable = arg0_paths.ruxex_self_exe.clone().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "failed to resolve the desktop executable for in-process App Server helpers",
        )
    })?;
    let runtime_paths = ruxex_app_server_client::ExecServerRuntimePaths::new(
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
#[serde(rename_all = "lowercase")]
pub(crate) enum AppServerDaemonAction {
    Start,
    Restart,
    Stop,
    Version,
}

impl AppServerDaemonAction {
    fn to_lifecycle_command(self) -> ruxex_app_server_daemon::LifecycleCommand {
        match self {
            Self::Start => ruxex_app_server_daemon::LifecycleCommand::Start,
            Self::Restart => ruxex_app_server_daemon::LifecycleCommand::Restart,
            Self::Stop => ruxex_app_server_daemon::LifecycleCommand::Stop,
            Self::Version => ruxex_app_server_daemon::LifecycleCommand::Version,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum AppServerEndpointKind {
    Local,
    Websocket,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum AppServerEndpoint {
    Local,
    Websocket {
        url: String,
        #[serde(rename = "authToken")]
        auth_token: Option<String>,
    },
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
enum DesktopAppServerEvent {
    Lagged { skipped: usize },
    ServerNotification(Value),
    ServerRequest(Value),
    Disconnected { message: String },
}

async fn connect_unix_socket(
    socket_path: AbsolutePathBuf,
) -> Result<RemoteAppServerClient, std::io::Error> {
    RemoteAppServerClient::connect(RemoteAppServerConnectArgs {
        endpoint: RemoteAppServerEndpoint::UnixSocket { socket_path },
        client_name: product_identity().product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: 128,
    })
    .await
}

async fn connect_remote_socket(
    url: String,
    auth_token: Option<String>,
) -> CommandResult<RemoteAppServerClient> {
    let websocket_url = platform::validate_remote_endpoint(&url).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Connection,
            "remote endpoint must be wss:// or loopback ws://",
        )
    })?;
    RemoteAppServerClient::connect(RemoteAppServerConnectArgs {
        endpoint: RemoteAppServerEndpoint::WebSocket {
            websocket_url,
            auth_token,
        },
        client_name: product_identity().product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: 128,
    })
    .await
    .map_err(|error| command_error(DesktopAppServerErrorKind::Connection, error.to_string()))
}

async fn install_connection(
    app: &AppHandle,
    state: &State<'_, AppServerState>,
    mut client: AppServerClient,
    status: AppServerStatus,
) -> CommandResult<AppServerStatus> {
    let old_shutdown = state.shutdown.lock().await.take();
    if let Some(sender) = old_shutdown {
        let _ = sender.send(()).await;
    }

    let request_handle = client.request_handle();
    *state.request_handle.lock().await = Some(request_handle);
    *state.status.lock().await = Some(status.clone());

    let (shutdown_tx, mut shutdown_rx) = tauri::async_runtime::channel(1);
    *state.shutdown.lock().await = Some(shutdown_tx);
    let event_app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => break,
                event = client.next_event() => {
                    let Some(event) = event else { break };
                    let payload = match event {
                        AppServerEvent::Lagged { skipped } => DesktopAppServerEvent::Lagged { skipped },
                        AppServerEvent::ServerNotification(notification) => {
                            match serde_json::to_value(notification) {
                                Ok(notification) => DesktopAppServerEvent::ServerNotification(notification),
                                Err(error) => DesktopAppServerEvent::Disconnected {
                                    message: format!("failed to serialize server notification: {error}"),
                                },
                            }
                        }
                        AppServerEvent::ServerRequest(request) => match serde_json::to_value(request) {
                            Ok(request) => DesktopAppServerEvent::ServerRequest(request),
                            Err(error) => DesktopAppServerEvent::Disconnected {
                                message: format!("failed to serialize server request: {error}"),
                            },
                        },
                        AppServerEvent::Disconnected { message } => {
                            DesktopAppServerEvent::Disconnected { message }
                        }
                    };
                    log_app_server_io(AppServerLogDirection::FromAppServer, &payload);
                    if event_app.emit("app-server-event", payload).is_err() {
                        break;
                    }
                }
            }
        }
        let _ = client.shutdown().await;
    });

    Ok(status)
}

async fn clear_connection_state(state: &AppServerState) {
    if let Some(sender) = state.shutdown.lock().await.take() {
        let _ = sender.send(()).await;
    }
    *state.request_handle.lock().await = None;
    *state.status.lock().await = None;
}

fn should_clear_connection_for_daemon_control(
    action: AppServerDaemonAction,
    status: Option<&AppServerStatus>,
) -> bool {
    action != AppServerDaemonAction::Version
        && status.is_none_or(|status| status.endpoint_kind == AppServerEndpointKind::Local)
}

async fn connect_daemon_endpoint(
    app: &AppHandle,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
    })?;
    let (client, effective_socket_path, bootstrapped_version, connected_version) =
        match connect_unix_socket(socket_path.clone()).await {
            Ok(client) => {
                let connected_version = client.server_version().map(str::to_owned);
                (
                    AppServerClient::Remote(client),
                    socket_path,
                    None,
                    connected_version,
                )
            }
            Err(_) => {
                #[cfg(feature = "example")]
                let _ = app;

                #[cfg(feature = "example")]
                {
                    let executable = std::env::current_exe().map_err(|error| {
                        command_error(
                            DesktopAppServerErrorKind::Lifecycle,
                            format!("failed to resolve the desktop executable: {error}"),
                        )
                    })?;
                    let lifecycle = ruxex_app_server_daemon::run_with_host_executable(
                        ruxex_app_server_daemon::LifecycleCommand::Start,
                        &executable,
                        &[
                            OsString::from(
                                ruxex_app_server_daemon::HOST_APP_SERVER_DAEMON_MODE_ARG,
                            ),
                            OsString::from("--managed-daemon"),
                        ],
                    )
                    .await
                    .map_err(|error| {
                        command_error(
                            DesktopAppServerErrorKind::Lifecycle,
                            format!("failed to start the dummy provider app-server: {error:#}"),
                        )
                    })?;
                    let effective_socket_path =
                        AbsolutePathBuf::from_absolute_path(lifecycle.socket_path.clone())
                            .map_err(|error| {
                                command_error(
                                    DesktopAppServerErrorKind::Initialization,
                                    error.to_string(),
                                )
                            })?;
                    let client = connect_unix_socket(effective_socket_path.clone())
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Initialization,
                                error.to_string(),
                            )
                        })?;
                    (
                        AppServerClient::Remote(client),
                        effective_socket_path,
                        lifecycle
                            .app_server_version
                            .or_else(|| Some("0.4.2".to_string())),
                        None,
                    )
                }

                #[cfg(not(feature = "example"))]
                {
                    let package_source =
                        crate::desktop::runtime_package_source(app).map_err(|error| {
                            command_error(DesktopAppServerErrorKind::Lifecycle, error)
                        })?;
                    let bootstrap = ruxex_app_server_daemon::bootstrap_from_package_with_host_args(
                        &package_source,
                        &[
                            OsString::from(
                                ruxex_app_server_daemon::HOST_APP_SERVER_DAEMON_MODE_ARG,
                            ),
                            OsString::from("--managed-daemon"),
                        ],
                    )
                    .await
                    .map_err(|error| {
                        command_error(DesktopAppServerErrorKind::Lifecycle, format!("{error:#}"))
                    })?;
                    let effective_socket_path =
                        AbsolutePathBuf::from_absolute_path(bootstrap.socket_path.clone())
                            .map_err(|error| {
                                command_error(
                                    DesktopAppServerErrorKind::Initialization,
                                    error.to_string(),
                                )
                            })?;
                    let client = connect_unix_socket(effective_socket_path.clone())
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Initialization,
                                error.to_string(),
                            )
                        })?;
                    (
                        AppServerClient::Remote(client),
                        effective_socket_path,
                        Some(bootstrap.app_server_version),
                        None,
                    )
                }
            }
        };
    let status = AppServerStatus {
        socket_path: effective_socket_path.display().to_string(),
        app_server_version: connected_version
            .or(bootstrapped_version)
            .unwrap_or_else(|| "unknown".to_string()),
        endpoint_kind: AppServerEndpointKind::Local,
        mode: Some(AppServerMode::Daemon),
    };
    Ok((client, status))
}

async fn connect_in_process_endpoint(
    arg0_paths: Arg0DispatchPaths,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let _home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let (executable, runtime_paths) = resolve_in_process_paths(&arg0_paths)?;
    let config = Config::load_with_cli_overrides_and_harness_overrides(
        Vec::new(),
        ConfigOverrides {
            ruxex_self_exe: Some(executable.clone()),
            ..ConfigOverrides::default()
        },
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to load in-process App Server config: {error}"),
        )
    })?;

    #[cfg(feature = "example")]
    let provider_factory = crate::dummy_provider::provider_factory();
    #[cfg(not(feature = "example"))]
    let provider_factory = (
        ruxex_app_server_client::AppServerRuntimeBuilder::build_from_provider_factory::<
            ruxex_providers::ResponsesModelProvider,
        >,
        ruxex_providers::ResponsesModelProvider::provider_descriptor(),
    );
    let provider_init = ruxex_app_server_client::provider_init_from_config_with_descriptor(
        &config,
        true,
        &provider_factory.1,
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to initialize the in-process provider: {error}"),
        )
    })?;
    let runtime = (provider_factory.0)(provider_init);
    let state_db = ruxex_core::init_state_db(&config).await;
    let environment_manager = ruxex_app_server_client::EnvironmentManager::from_ruxex_home(
        &config.ruxex_home,
        Some(runtime_paths),
        config.http_client_factory(),
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to initialize in-process environment manager: {error}"),
        )
    })?;
    let config_warnings = config
        .startup_warnings
        .iter()
        .cloned()
        .map(|summary| ConfigWarningNotification {
            summary,
            details: None,
            path: None,
            range: None,
        })
        .collect();
    let product_identity = product_identity();
    let client = InProcessAppServerClient::start(InProcessClientStartArgs {
        arg0_paths,
        config: Arc::new(config),
        cli_overrides: Vec::new(),
        loader_overrides: LoaderOverrides::default(),
        strict_config: false,
        log_db: None,
        state_db,
        environment_manager: Arc::new(environment_manager),
        config_warnings,
        session_source: SessionSource::Cli,
        enable_api_key_env: true,
        runtime: Some(runtime),
        client_name: product_identity.product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: ruxex_app_server_client::DEFAULT_IN_PROCESS_CHANNEL_CAPACITY,
        product_identity,
    })
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to start in-process App Server: {error}"),
        )
    })?;
    let client = AppServerClient::InProcess(client);
    let app_server_version = client
        .identity()
        .map(|identity| identity.version.clone())
        .unwrap_or_else(|| "unknown".to_string());
    let status = AppServerStatus {
        socket_path: "in-process".to_string(),
        app_server_version,
        endpoint_kind: AppServerEndpointKind::Local,
        mode: Some(AppServerMode::InProcess),
    };
    Ok((client, status))
}

async fn connect_local_endpoint(
    app: &AppHandle,
    arg0_paths: Arg0DispatchPaths,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    match configured_app_server_mode()? {
        AppServerMode::Daemon => connect_daemon_endpoint(app).await,
        AppServerMode::InProcess => connect_in_process_endpoint(arg0_paths).await,
    }
}

#[tauri::command]
pub(crate) async fn connect_app_server(
    app: AppHandle,
    state: State<'_, AppServerState>,
    endpoint: AppServerEndpoint,
) -> CommandResult<AppServerStatus> {
    let _initialization = state.initialization.lock().await;
    let (client, status) = match endpoint {
        AppServerEndpoint::Local => connect_local_endpoint(&app, state.arg0_paths.clone()).await?,
        AppServerEndpoint::Websocket { url, auth_token } => {
            let client = connect_remote_socket(url.clone(), auth_token).await?;
            let app_server_version = client.server_version().unwrap_or("unknown").to_string();
            let status = AppServerStatus {
                socket_path: url,
                app_server_version,
                endpoint_kind: AppServerEndpointKind::Websocket,
                mode: None,
            };
            (AppServerClient::Remote(client), status)
        }
    };
    install_connection(&app, &state, client, status).await
}

#[tauri::command]
pub(crate) async fn disconnect_app_server(state: State<'_, AppServerState>) -> CommandResult<()> {
    let _initialization = state.initialization.lock().await;
    clear_connection_state(&state).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn app_server_daemon_control(
    state: State<'_, AppServerState>,
    action: AppServerDaemonAction,
) -> CommandResult<ruxex_app_server_daemon::LifecycleOutput> {
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
    if should_clear_connection_for_daemon_control(action, status.as_ref()) {
        clear_connection_state(&state).await;
    }

    let command = action.to_lifecycle_command();
    let output = {
        #[cfg(feature = "example")]
        {
            let executable = std::env::current_exe().map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Lifecycle,
                    format!("failed to resolve the Desktop executable: {error}"),
                )
            })?;
            let command_args = [
                OsString::from(ruxex_app_server_daemon::HOST_APP_SERVER_DAEMON_MODE_ARG),
                OsString::from("--managed-daemon"),
            ];
            ruxex_app_server_daemon::run_with_host_executable(command, &executable, &command_args)
                .await
        }
        #[cfg(not(feature = "example"))]
        {
            ruxex_app_server_daemon::run(command).await
        }
    };

    output.map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("AppServer daemon {action:?} failed: {error:#}"),
        )
    })
}

#[tauri::command]
pub(crate) async fn app_server_connection_status(
    state: State<'_, AppServerState>,
) -> CommandResult<Option<AppServerStatus>> {
    Ok(state.status.lock().await.clone())
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
    let (client, status) = connect_local_endpoint(&app, state.arg0_paths.clone()).await?;
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
    use ruxex_arg0::Arg0DispatchPaths;
    use serde_json::json;

    use super::{
        AppServerDaemonAction, AppServerEndpoint, AppServerEndpointKind, AppServerMode,
        AppServerStatus, DESKTOP_EXPERIMENTAL_API, DesktopAppServerEvent, parse_app_server_mode,
        resolve_in_process_paths, should_clear_connection_for_daemon_control,
    };

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
    fn daemon_actions_map_to_lifecycle_commands() {
        assert_eq!(
            AppServerDaemonAction::Start.to_lifecycle_command(),
            ruxex_app_server_daemon::LifecycleCommand::Start
        );
        assert_eq!(
            AppServerDaemonAction::Restart.to_lifecycle_command(),
            ruxex_app_server_daemon::LifecycleCommand::Restart
        );
        assert_eq!(
            AppServerDaemonAction::Stop.to_lifecycle_command(),
            ruxex_app_server_daemon::LifecycleCommand::Stop
        );
        assert_eq!(
            AppServerDaemonAction::Version.to_lifecycle_command(),
            ruxex_app_server_daemon::LifecycleCommand::Version
        );
    }

    #[test]
    fn daemon_actions_use_camel_case_wire_names() {
        for (wire_name, expected) in [
            ("start", AppServerDaemonAction::Start),
            ("restart", AppServerDaemonAction::Restart),
            ("stop", AppServerDaemonAction::Stop),
            ("version", AppServerDaemonAction::Version),
        ] {
            let decoded: AppServerDaemonAction = serde_json::from_value(json!(wire_name)).unwrap();
            assert_eq!(decoded, expected);
        }
    }

    #[test]
    fn daemon_control_only_clears_local_connections() {
        let local = AppServerStatus {
            socket_path: "/tmp/app-server.sock".to_string(),
            app_server_version: "local".to_string(),
            endpoint_kind: AppServerEndpointKind::Local,
            mode: Some(AppServerMode::Daemon),
        };
        let remote = AppServerStatus {
            socket_path: "wss://example.test/rpc".to_string(),
            app_server_version: "remote".to_string(),
            endpoint_kind: AppServerEndpointKind::Websocket,
            mode: None,
        };

        assert!(should_clear_connection_for_daemon_control(
            AppServerDaemonAction::Restart,
            Some(&local),
        ));
        assert!(!should_clear_connection_for_daemon_control(
            AppServerDaemonAction::Restart,
            Some(&remote),
        ));
        assert!(!should_clear_connection_for_daemon_control(
            AppServerDaemonAction::Version,
            Some(&local),
        ));
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
    fn app_server_status_and_remote_endpoints_keep_the_bridge_contract() {
        let status = AppServerStatus {
            socket_path: "wss://example.test/rpc".to_string(),
            app_server_version: "remote".to_string(),
            endpoint_kind: AppServerEndpointKind::Websocket,
            mode: None,
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "socketPath": "wss://example.test/rpc",
                "appServerVersion": "remote",
                "endpointKind": "websocket",
            })
        );

        let status = AppServerStatus {
            socket_path: "/tmp/app-server.sock".to_string(),
            app_server_version: "local".to_string(),
            endpoint_kind: AppServerEndpointKind::Local,
            mode: Some(AppServerMode::InProcess),
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "socketPath": "/tmp/app-server.sock",
                "appServerVersion": "local",
                "endpointKind": "local",
                "mode": "inprocess",
            })
        );

        let endpoint: AppServerEndpoint = serde_json::from_value(json!({
            "kind": "websocket",
            "url": "wss://example.test/rpc",
            "authToken": "memory-only-token",
        }))
        .unwrap();
        assert!(
            matches!(endpoint, AppServerEndpoint::Websocket { url, auth_token: Some(token) } if url == "wss://example.test/rpc" && token == "memory-only-token")
        );
    }
}
