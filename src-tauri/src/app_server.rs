use std::ffi::OsString;

use ruxex::app_server::app_server_control_socket_path;
use ruxex_app_server_client::{
    AppServerEvent, AppServerRequestHandle, RemoteAppServerClient, RemoteAppServerConnectArgs,
    RemoteAppServerEndpoint,
};
use ruxex_app_server_protocol::{
    ClientRequest, ClientResponse, JSONRPCErrorError, RequestId, Result as JsonRpcResult,
};
use ruxex_utils_absolute_path::AbsolutePathBuf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use ruxex_scheduler::{AppServerLogDirection, log_app_server_io};

use crate::desktop::{product_identity, ruxex_home};
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

const DESKTOP_EXPERIMENTAL_API: bool = true;

#[derive(Default)]
pub(crate) struct AppServerState {
    initialization: tauri::async_runtime::Mutex<()>,
    request_handle: tauri::async_runtime::Mutex<Option<AppServerRequestHandle>>,
    status: tauri::async_runtime::Mutex<Option<AppServerStatus>>,
    shutdown: tauri::async_runtime::Mutex<Option<tauri::async_runtime::Sender<()>>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppServerStatus {
    socket_path: String,
    app_server_version: String,
    endpoint_kind: AppServerEndpointKind,
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
    mut client: RemoteAppServerClient,
    status: AppServerStatus,
) -> CommandResult<AppServerStatus> {
    let old_shutdown = state.shutdown.lock().await.take();
    if let Some(sender) = old_shutdown {
        let _ = sender.send(()).await;
    }

    let request_handle = client.request_handle();
    *state.request_handle.lock().await = Some(AppServerRequestHandle::Remote(request_handle));
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

async fn connect_local_endpoint(
    app: &AppHandle,
) -> CommandResult<(RemoteAppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
    })?;
    let (client, effective_socket_path, bootstrapped_version) =
        match connect_unix_socket(socket_path.clone()).await {
            Ok(client) => (client, socket_path, None),
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
                        client,
                        effective_socket_path,
                        lifecycle
                            .app_server_version
                            .or_else(|| Some("0.4.2".to_string())),
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
                        client,
                        effective_socket_path,
                        Some(bootstrap.app_server_version),
                    )
                }
            }
        };
    let status = AppServerStatus {
        socket_path: effective_socket_path.display().to_string(),
        app_server_version: client
            .server_version()
            .map(str::to_owned)
            .or(bootstrapped_version)
            .unwrap_or_else(|| "unknown".to_string()),
        endpoint_kind: AppServerEndpointKind::Local,
    };
    Ok((client, status))
}

#[tauri::command]
pub(crate) async fn connect_app_server(
    app: AppHandle,
    state: State<'_, AppServerState>,
    endpoint: AppServerEndpoint,
) -> CommandResult<AppServerStatus> {
    let _initialization = state.initialization.lock().await;
    let (client, status) = match endpoint {
        AppServerEndpoint::Local => connect_local_endpoint(&app).await?,
        AppServerEndpoint::Websocket { url, auth_token } => {
            let client = connect_remote_socket(url.clone(), auth_token).await?;
            let status = AppServerStatus {
                socket_path: url,
                app_server_version: client.server_version().unwrap_or("unknown").to_string(),
                endpoint_kind: AppServerEndpointKind::Websocket,
            };
            (client, status)
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
    let (client, status) = connect_local_endpoint(&app).await?;
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
    use serde_json::json;

    use super::{
        AppServerDaemonAction, AppServerEndpoint, AppServerEndpointKind, AppServerStatus,
        DESKTOP_EXPERIMENTAL_API, DesktopAppServerEvent,
        should_clear_connection_for_daemon_control,
    };

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
        };
        let remote = AppServerStatus {
            socket_path: "wss://example.test/rpc".to_string(),
            app_server_version: "remote".to_string(),
            endpoint_kind: AppServerEndpointKind::Websocket,
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
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "socketPath": "wss://example.test/rpc",
                "appServerVersion": "remote",
                "endpointKind": "websocket",
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
