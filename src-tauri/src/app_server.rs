use std::ffi::OsString;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use ruxex::arg0::{Arg0DispatchPaths, Arg0PathEntryGuard};
use ruxex::desktop::config::LoaderOverrides;
use ruxex::desktop::core::{
    self,
    config::{Config, ConfigOverrides},
};
use ruxex::desktop::daemon::run_with_host_executable;
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
    daemon::{
        BackendKind, HOST_APP_SERVER_DAEMON_MODE_ARG, LifecycleCommand, LifecycleOutput,
        LifecycleStatus,
    },
    protocol::{
        ClientRequest, ClientResponse, ConfigWarningNotification, JSONRPCErrorError, RequestId,
        Result as JsonRpcResult,
    },
};
use ruxex::protocol::protocol::SessionSource;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use ruxex_scheduler::{AppServerLogDirection, log_app_server_io};

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

async fn connect_unix_socket(
    socket_path: AbsolutePathBuf,
    config: &DesktopConfig,
) -> Result<RemoteAppServerClient, std::io::Error> {
    RemoteAppServerClient::connect(RemoteAppServerConnectArgs {
        endpoint: RemoteAppServerEndpoint::UnixSocket { socket_path },
        client_name: config.product_identity().product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: 128,
    })
    .await
}

fn client_socket_candidates(data_home: &Path) -> Result<Vec<AbsolutePathBuf>, String> {
    let logical_socket_path = app_server_control_socket_path(data_home)
        .map_err(|error| format!("failed to resolve App Server control socket: {error}"))?;
    let mut socket_paths = vec![logical_socket_path];
    #[cfg(unix)]
    {
        let physical_socket_path =
            AbsolutePathBuf::from_absolute_path(client_physical_socket_path(data_home)?)
                .map_err(|error| error.to_string())?;
        if socket_paths[0] != physical_socket_path {
            socket_paths.push(physical_socket_path);
        }
    }
    Ok(socket_paths)
}

#[cfg(unix)]
fn client_physical_socket_path(data_home: &Path) -> Result<PathBuf, String> {
    use sha2::Digest;
    use sha2::Sha256;
    use std::os::unix::ffi::OsStrExt;

    let logical_path = data_home
        .join("app-server-control")
        .join("app-server-control.sock");
    let parent = logical_path
        .parent()
        .ok_or_else(|| "App Server socket path has no parent".to_string())?;
    let canonical_parent = canonicalize_existing_prefix(parent)?;
    let canonical_path = canonical_parent.join(
        logical_path
            .file_name()
            .ok_or_else(|| "App Server socket path has no filename".to_string())?,
    );
    let hash = Sha256::digest(canonical_path.as_os_str().as_bytes());
    let temporary_root = std::fs::canonicalize("/tmp")
        .map_err(|error| format!("failed to resolve temporary directory: {error}"))?;
    let uid = unsafe { libc::geteuid() };
    Ok(temporary_root
        .join(format!("ruxex-daemon-{uid}"))
        .join(format!("{hash:x}")))
}

#[cfg(unix)]
fn canonicalize_existing_prefix(path: &Path) -> Result<PathBuf, String> {
    let mut current = path.to_path_buf();
    let mut missing = Vec::<OsString>::new();
    while !current.exists() {
        let name = current
            .file_name()
            .ok_or_else(|| "App Server socket path has no existing ancestor".to_string())?;
        missing.push(name.to_os_string());
        current.pop();
    }

    let mut canonical = std::fs::canonicalize(&current)
        .map_err(|error| format!("failed to canonicalize App Server socket path: {error}"))?;
    for name in missing.iter().rev() {
        canonical.push(name);
    }
    Ok(canonical)
}

#[cfg(unix)]
async fn client_socket_peer_pid(socket_path: &Path) -> Result<Option<u32>, String> {
    let stream = tokio::net::UnixStream::connect(socket_path)
        .await
        .map_err(|error| format!("failed to connect to App Server socket: {error}"))?;
    stream
        .peer_cred()
        .map_err(|error| format!("failed to inspect App Server socket owner: {error}"))?
        .pid()
        .map(|pid| {
            u32::try_from(pid).map_err(|_| "App Server socket owner PID is invalid".to_string())
        })
        .transpose()
}

struct DaemonSocketProbe {
    socket_path: AbsolutePathBuf,
    app_server_version: Option<String>,
    peer_pid: Option<u32>,
}

async fn probe_daemon_socket(
    socket_path: AbsolutePathBuf,
    config: &DesktopConfig,
) -> Option<DaemonSocketProbe> {
    let client = connect_unix_socket(socket_path.clone(), config)
        .await
        .ok()?;
    let app_server_version = client.server_version().map(str::to_owned);
    #[cfg(unix)]
    let peer_pid = client_socket_peer_pid(socket_path.as_path())
        .await
        .ok()
        .flatten();
    #[cfg(not(unix))]
    let peer_pid = None;
    let _ = client.shutdown().await;
    Some(DaemonSocketProbe {
        socket_path,
        app_server_version,
        peer_pid,
    })
}

async fn probe_physical_residual_daemon(
    config: &DesktopConfig,
) -> CommandResult<Option<DaemonSocketProbe>> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_paths = client_socket_candidates(&home)
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let Some(physical_socket_path) = socket_paths.get(1).cloned() else {
        return Ok(None);
    };

    if probe_daemon_socket(socket_paths[0].clone(), config)
        .await
        .is_some()
    {
        return Ok(None);
    }
    Ok(probe_daemon_socket(physical_socket_path, config).await)
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

async fn connect_daemon_endpoint(
    config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
    })?;
    #[cfg(unix)]
    let physical_socket_path = AbsolutePathBuf::from_absolute_path(
        client_physical_socket_path(&home)
            .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?,
    )
    .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error.to_string()))?;
    let (client, effective_socket_path, bootstrapped_version, connected_version) =
        match connect_unix_socket(socket_path.clone(), config).await {
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
                #[cfg(unix)]
                let physical_connection = if physical_socket_path.as_path() != socket_path.as_path()
                {
                    connect_unix_socket(physical_socket_path.clone(), config)
                        .await
                        .ok()
                } else {
                    None
                };
                #[cfg(not(unix))]
                let physical_connection: Option<RemoteAppServerClient> = None;
                if let Some(client) = physical_connection {
                    let connected_version = client.server_version().map(str::to_owned);
                    (
                        AppServerClient::Remote(client),
                        #[cfg(unix)]
                        physical_socket_path,
                        #[cfg(not(unix))]
                        socket_path,
                        None,
                        connected_version,
                    )
                } else {
                    let lifecycle = run_desktop_app_server_lifecycle(LifecycleCommand::Start)
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Lifecycle,
                                format!(
                                    "failed to start the {} provider app-server: {error:#}",
                                    config.provider_factory.1.provider_kind
                                ),
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
                    let client = connect_unix_socket(effective_socket_path.clone(), config)
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
            }
        };
    let status = AppServerStatus {
        socket_path: effective_socket_path.display().to_string(),
        home_data_dir: home.display().to_string(),
        app_server_version: connected_version
            .or(bootstrapped_version)
            .unwrap_or_else(|| "unknown".to_string()),
        mode: Some(AppServerMode::Daemon),
    };
    Ok((client, status))
}

async fn connect_in_process_endpoint(
    arg0_paths: Arg0DispatchPaths,
    desktop_config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let (executable, runtime_paths) = resolve_in_process_paths(&arg0_paths)?;
    let loaded_config = Config::load_with_cli_overrides_and_harness_overrides(
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

    let runtime = initialize_in_process_runtime(&loaded_config, desktop_config)
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to initialize the in-process provider: {error}"),
            )
        })?;
    let state_db = core::init_state_db(&loaded_config).await;
    let environment_manager = EnvironmentManager::from_ruxex_home(
        &loaded_config.ruxex_home,
        Some(runtime_paths),
        loaded_config.http_client_factory(),
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to initialize in-process environment manager: {error}"),
        )
    })?;
    let config_warnings = loaded_config
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
    let product_identity = desktop_config.product_identity();
    let client = InProcessAppServerClient::start(InProcessClientStartArgs {
        arg0_paths,
        config: Arc::new(loaded_config),
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
        channel_capacity: DEFAULT_IN_PROCESS_CHANNEL_CAPACITY,
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
        home_data_dir: home.display().to_string(),
        app_server_version,
        mode: Some(AppServerMode::InProcess),
    };
    Ok((client, status))
}

async fn initialize_in_process_runtime(
    loaded_config: &Config,
    desktop_config: &DesktopConfig,
) -> anyhow::Result<ruxex::desktop::client::AppServerRuntime> {
    let provider_factory = &desktop_config.provider_factory;
    let provider_init = provider_init_from_config_with_descriptor(
        loaded_config,
        true,
        &provider_factory.1,
        desktop_config.product_identity().home_marker_file(),
    )
    .await?;
    Ok((provider_factory.0)(provider_init))
}

fn desktop_app_server_daemon_args() -> [OsString; 2] {
    [
        OsString::from(HOST_APP_SERVER_DAEMON_MODE_ARG),
        OsString::from("--managed-daemon"),
    ]
}

async fn run_desktop_app_server_lifecycle(
    command: LifecycleCommand,
) -> anyhow::Result<LifecycleOutput> {
    let executable = std::env::current_exe()?;
    run_with_host_executable(command, &executable, &desktop_app_server_daemon_args()).await
}

async fn version_from_client(
    config: &DesktopConfig,
    lifecycle_error: anyhow::Error,
) -> CommandResult<LifecycleOutput> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_paths = client_socket_candidates(&home)
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;

    let mut probe_error = None;
    for socket_path in socket_paths {
        match probe_daemon_socket(socket_path.clone(), config).await {
            Some(probe) => {
                return Ok(LifecycleOutput {
                    status: LifecycleStatus::Running,
                    backend: Some(BackendKind::Pid),
                    pid: None,
                    managed_ruxex_path: PathBuf::new(),
                    managed_ruxex_version: None,
                    socket_path: probe.socket_path.as_path().to_path_buf(),
                    cli_version: None,
                    app_server_version: probe.app_server_version,
                });
            }
            None => {
                probe_error = Some(format!(
                    "failed to connect to {}",
                    socket_path.as_path().display()
                ))
            }
        }
    }

    Err(command_error(
        DesktopAppServerErrorKind::Lifecycle,
        format!(
            "AppServer daemon Version failed through the lifecycle client: {lifecycle_error:#}; physical socket probe failed: {}",
            probe_error
                .map(|error| error.to_string())
                .unwrap_or_else(|| "no socket candidate was available".to_string())
        ),
    ))
}

async fn connect_local_endpoint(
    arg0_paths: Arg0DispatchPaths,
    config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let (client, status) = match configured_app_server_mode()? {
        AppServerMode::Daemon => connect_daemon_endpoint(config).await,
        AppServerMode::InProcess => connect_in_process_endpoint(arg0_paths, config).await,
    }?;
    apply_desktop_skill_policy(&client, config)
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to apply desktop Skill policy: {error}"),
            )
        })?;
    Ok((client, status))
}

fn recovered_daemon_output(status: LifecycleStatus, probe: &DaemonSocketProbe) -> LifecycleOutput {
    LifecycleOutput {
        status,
        backend: Some(BackendKind::Pid),
        pid: None,
        managed_ruxex_path: PathBuf::new(),
        managed_ruxex_version: None,
        socket_path: probe.socket_path.as_path().to_path_buf(),
        cli_version: None,
        app_server_version: probe.app_server_version.clone(),
    }
}

#[cfg(unix)]
async fn recovered_daemon_socket_is_owned_by(probe: &DaemonSocketProbe, pid: u32) -> bool {
    client_socket_peer_pid(probe.socket_path.as_path())
        .await
        .ok()
        .flatten()
        == Some(pid)
}

#[cfg(unix)]
async fn stop_recovered_daemon(probe: &DaemonSocketProbe) -> CommandResult<()> {
    let pid = probe.peer_pid.ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            "cannot stop residual App Server daemon: socket owner PID is unavailable",
        )
    })?;
    terminate_process(pid).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to gracefully stop residual App Server daemon: {error}"),
        )
    })?;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    while recovered_daemon_socket_is_owned_by(probe, pid).await {
        if tokio::time::Instant::now() >= deadline {
            force_terminate_process(pid).map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Lifecycle,
                    format!(
                        "residual App Server daemon did not stop gracefully; force stop failed: {error}"
                    ),
                )
            })?;
            let force_deadline = tokio::time::Instant::now() + Duration::from_secs(10);
            while recovered_daemon_socket_is_owned_by(probe, pid).await {
                if tokio::time::Instant::now() >= force_deadline {
                    return Err(command_error(
                        DesktopAppServerErrorKind::Lifecycle,
                        format!("timed out waiting for residual App Server daemon {pid} to stop"),
                    ));
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Ok(())
}

async fn force_stop_app_server_daemon() -> CommandResult<LifecycleOutput> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    #[cfg(unix)]
    let physical_socket_path = client_physical_socket_path(&home).ok();
    #[cfg(unix)]
    let socket_owner_pid = match physical_socket_path.as_deref() {
        Some(path) => client_socket_peer_pid(path).await.ok().flatten(),
        None => None,
    };
    #[cfg(not(unix))]
    let socket_owner_pid = None;

    let pid = if let Some(pid) = socket_owner_pid {
        pid
    } else {
        let pid_file = [
            home.join("app-server-daemon/daemon.pid"),
            home.join("app-server.pid"),
        ]
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| {
            command_error(
                DesktopAppServerErrorKind::Lifecycle,
                "App Server daemon is not running (no live socket or PID file was found)",
            )
        })?;
        let pid_contents = tokio::fs::read_to_string(&pid_file)
            .await
            .map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Lifecycle,
                    format!("failed to read App Server daemon PID file: {error}"),
                )
            })?;
        let record: AppServerPidRecord = serde_json::from_str(&pid_contents).map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Lifecycle,
                format!("failed to decode App Server daemon PID file: {error}"),
            )
        })?;
        record.pid
    };

    force_terminate_process(pid).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to force terminate App Server daemon: {error}"),
        )
    })?;

    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve App Server socket path: {error}"),
        )
    })?;
    Ok(LifecycleOutput {
        status: LifecycleStatus::Stopped,
        backend: Some(BackendKind::Pid),
        pid: None,
        managed_ruxex_path: PathBuf::new(),
        managed_ruxex_version: None,
        socket_path: socket_path.as_path().to_path_buf(),
        cli_version: None,
        app_server_version: None,
    })
}

fn force_terminate_process(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("PID must be greater than zero".to_string());
    }

    #[cfg(unix)]
    {
        let raw_pid = libc::pid_t::try_from(pid)
            .map_err(|_| format!("PID {pid} is out of range for this platform"))?;
        let result = unsafe { libc::kill(raw_pid, libc::SIGKILL) };
        if result == 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ESRCH) {
            return Ok(());
        }
        return Err(error.to_string());
    }

    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("taskkill exited with status {status}"))
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = pid;
        Err("force termination is unsupported on this platform".to_string())
    }
}

#[cfg(unix)]
fn terminate_process(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("PID must be greater than zero".to_string());
    }

    let raw_pid = libc::pid_t::try_from(pid)
        .map_err(|_| format!("PID {pid} is out of range for this platform"))?;
    let result = unsafe { libc::kill(raw_pid, libc::SIGTERM) };
    if result == 0 {
        return Ok(());
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        Ok(())
    } else {
        Err(error.to_string())
    }
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
    use super::initialize_in_process_runtime;

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
