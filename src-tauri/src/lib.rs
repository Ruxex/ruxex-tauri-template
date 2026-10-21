use std::ffi::OsString;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicI64, Ordering};

use base64::Engine;
use chrono::Utc;
use ruxex_app_server_client::AppServerEvent;
use ruxex_app_server_client::AppServerRequestHandle;
use ruxex_app_server_client::RemoteAppServerClient;
use ruxex_app_server_client::RemoteAppServerConnectArgs;
use ruxex_app_server_client::RemoteAppServerEndpoint;
use ruxex_app_server_protocol::ClientRequest;
use ruxex_app_server_protocol::ClientResponse;
use ruxex_app_server_protocol::JSONRPCErrorError;
use ruxex_app_server_protocol::RequestId;
use ruxex_app_server_protocol::Result as JsonRpcResult;
use ruxex_utils_absolute_path::AbsolutePathBuf;
use ruxex_utils_home_dir::ProductIdentity;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;

mod platform;
mod scheduler;
mod worktree;

#[derive(Default)]
struct AppState {
    initialization: tauri::async_runtime::Mutex<()>,
    request_handle: tauri::async_runtime::Mutex<Option<AppServerRequestHandle>>,
    status: tauri::async_runtime::Mutex<Option<AppServerStatus>>,
    shutdown: tauri::async_runtime::Mutex<Option<tauri::async_runtime::Sender<()>>>,
    schedule_lock: tauri::async_runtime::Mutex<()>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppServerStatus {
    socket_path: String,
    app_server_version: String,
    endpoint_kind: AppServerEndpointKind,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum AppServerEndpointKind {
    Local,
    Websocket,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum AppServerEndpoint {
    Local,
    Websocket {
        url: String,
        #[serde(rename = "authToken")]
        auth_token: Option<String>,
    },
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum DesktopAppServerErrorKind {
    Lifecycle,
    Initialization,
    Connection,
    Transport,
    Server,
    Decode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAppServerError {
    kind: DesktopAppServerErrorKind,
    message: String,
}

type CommandResult<T> = Result<T, DesktopAppServerError>;

fn command_error(
    kind: DesktopAppServerErrorKind,
    message: impl Into<String>,
) -> DesktopAppServerError {
    DesktopAppServerError {
        kind,
        message: message.into(),
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            let home = desktop_ruxex_home().map_err(std::io::Error::other)?;

            // The setup hook runs before Tauri exposes commands or starts the
            // app-server child, so these process-wide values are safe to set
            // once here and are inherited by the managed daemon.
            unsafe {
                std::env::set_var("RUXEX_HOME", &home);
                std::env::set_var("RUXEX_SQLITE_HOME", &home);
            }
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let _ = run_due_schedules(&app_handle).await;
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ensure_app_server,
            connect_app_server,
            disconnect_app_server,
            app_server_connection_status,
            read_image_file,
            open_browser_window,
            schedule_list,
            schedule_create,
            schedule_update,
            schedule_delete,
            schedule_run_now,
            worktree_list,
            worktree_create,
            worktree_remove,
            worktree_open,
            app_server_request,
            app_server_resolve_server_request,
            app_server_reject_server_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ruxex Desktop");
}

#[cfg(test)]
mod tests {
    use super::DESKTOP_EXPERIMENTAL_API;
    use super::AppServerEndpoint;
    use super::AppServerEndpointKind;
    use super::AppServerStatus;
    use super::DesktopAppServerEvent;
    use super::DesktopAppServerErrorKind;
    use super::command_error;
    use super::desktop_product_identity;
    use super::desktop_ruxex_home_from_user_home;
    use super::select_runtime_package;
    use serde_json::json;
    use std::fs;
    use std::path::Path;
    use std::path::PathBuf;

    #[test]
    fn desktop_home_is_isolated_under_user_home() {
        assert_eq!(
            desktop_ruxex_home_from_user_home(Path::new("/home/user")),
            Path::new("/home/user/.ruxex_desktop"),
        );
    }

    #[test]
    fn desktop_product_identity_is_separate_from_tui_branding() {
        let identity = desktop_product_identity();

        assert_eq!(identity.product_name(), "Ruxex Desktop");
        assert_eq!(identity.product_slug(), "ruxex-desktop");
        assert_eq!(identity.home_dir_name(), ".ruxex_desktop");
    }

    #[test]
    fn desktop_connects_with_experimental_protocol_capability() {
        assert!(DESKTOP_EXPERIMENTAL_API);
    }

    #[test]
    fn app_server_error_categories_are_structured() {
        let errors = [
            command_error(DesktopAppServerErrorKind::Initialization, "bad handshake"),
            command_error(DesktopAppServerErrorKind::Transport, "socket closed"),
            command_error(DesktopAppServerErrorKind::Server, "request rejected"),
        ];
        let kinds = errors
            .into_iter()
            .map(|error| serde_json::to_value(error).unwrap()["kind"].clone())
            .collect::<Vec<_>>();
        assert_eq!(
            kinds,
            [json!("initialization"), json!("transport"), json!("server")]
        );

        let transport_error = command_error(DesktopAppServerErrorKind::Transport, "socket closed");
        assert_eq!(
            serde_json::to_value(transport_error).unwrap(),
            json!({
                "kind": "transport",
                "message": "socket closed",
            })
        );
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
        assert!(matches!(endpoint, AppServerEndpoint::Websocket { url, auth_token: Some(token) } if url == "wss://example.test/rpc" && token == "memory-only-token"));
    }

    fn package_fixture(name: &str, with_manifest: bool) -> PathBuf {
        let path = std::env::temp_dir().join(format!("ruxex-desktop-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        if with_manifest {
            fs::write(path.join("ruxex-package.json"), "{}\n").unwrap();
        }
        path
    }

    #[test]
    fn runtime_package_selection_prefers_bundled_resources() {
        let resource = package_fixture("resource", true);
        let development = package_fixture("development", true);

        assert_eq!(select_runtime_package(&resource, &development).unwrap(), resource);

        let _ = fs::remove_dir_all(development);
        let _ = fs::remove_dir_all(resource);
    }

    #[test]
    fn runtime_package_selection_falls_back_to_development_resources() {
        let resource = package_fixture("missing-resource", false);
        let development = package_fixture("fallback", true);

        assert_eq!(select_runtime_package(&resource, &development).unwrap(), development);

        let _ = fs::remove_dir_all(resource);
        let _ = fs::remove_dir_all(development);
    }

    #[test]
    fn runtime_package_selection_reports_both_missing_locations() {
        let resource = std::env::temp_dir().join("ruxex-desktop-no-resource");
        let development = std::env::temp_dir().join("ruxex-desktop-no-development");
        let error = select_runtime_package(&resource, &development).unwrap_err();

        assert!(error.contains("bundled Ruxex runtime package not found"));
        assert!(error.contains(&resource.display().to_string()));
        assert!(error.contains(&development.display().to_string()));
    }
}

const DESKTOP_EXPERIMENTAL_API: bool = true;

fn desktop_product_identity() -> ProductIdentity {
    ProductIdentity::new(
        "Ruxex Desktop",
        "ruxex-desktop",
        ".ruxex_desktop",
        "ruxex-home.json",
    )
    .expect("desktop product identity is static and valid")
}

fn desktop_ruxex_home_from_user_home(user_home: &Path) -> PathBuf {
    desktop_product_identity()
        .resolve_home_from(user_home)
        .expect("desktop user home should be absolute")
        .into_path_buf()
}

fn desktop_ruxex_home() -> Result<PathBuf, String> {
    let user_home =
        dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
    let home = desktop_ruxex_home_from_user_home(&user_home);
    fs::create_dir_all(&home)
        .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
    Ok(home)
}

#[tauri::command]
fn read_image_file(path: String) -> CommandResult<String> {
    let requested = PathBuf::from(&path);
    if !requested.is_absolute() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path must be absolute",
        ));
    }
    let canonical = requested.canonicalize().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("image path cannot be opened: {error}"),
        )
    })?;
    let home = desktop_ruxex_home()
        .map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    let roots = [home, workspace];
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots.iter().map(PathBuf::as_path).collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path is outside the Ruxex or workspace roots",
        ));
    }
    let mime = platform::image_mime_type(&canonical).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "only png, jpeg, gif, and webp images are supported",
        )
    })?;
    let bytes = fs::read(&canonical).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read image: {error}"),
        )
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image exceeds the 16 MiB presentation limit",
        ));
    }
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
fn open_browser_window(url: String) -> CommandResult<()> {
    let url = platform::validate_browser_url(&url).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "browser URL must use http:// or https://",
        )
    })?;
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to open browser URL: {error}"),
        )
    })
}

static NEXT_SCHEDULE_REQUEST_ID: AtomicI64 = AtomicI64::new(10_000_000);

fn next_schedule_request_id() -> i64 {
    NEXT_SCHEDULE_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
}

fn schedule_error(message: impl Into<String>) -> DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}

fn schedule_home() -> Result<PathBuf, DesktopAppServerError> {
    desktop_ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))
}

fn schedule_file_error(message: String) -> DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}

#[tauri::command]
async fn schedule_list(
    state: State<'_, AppState>,
) -> CommandResult<Vec<scheduler::ScheduleRecord>> {
    let _lock = state.schedule_lock.lock().await;
    let home = schedule_home()?;
    Ok(scheduler::load(&home)
        .map_err(schedule_file_error)?
        .schedules)
}

#[tauri::command]
async fn schedule_create(
    state: State<'_, AppState>,
    input: scheduler::ScheduleInput,
) -> CommandResult<scheduler::ScheduleRecord> {
    let _lock = state.schedule_lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let id = format!("schedule-{}-{}", Utc::now().timestamp_millis(), std::process::id());
    let record = scheduler::new_record(id, input, Utc::now()).map_err(schedule_error)?;
    file.schedules.push(record.clone());
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

#[tauri::command]
async fn schedule_update(
    state: State<'_, AppState>,
    id: String,
    input: scheduler::ScheduleInput,
) -> CommandResult<scheduler::ScheduleRecord> {
    let _lock = state.schedule_lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let index = file
        .schedules
        .iter()
        .position(|schedule| schedule.id == id)
        .ok_or_else(|| schedule_error("schedule not found"))?;
    let previous = &file.schedules[index];
    let mut record = scheduler::new_record(id, input, Utc::now()).map_err(schedule_error)?;
    record.enabled = previous.enabled;
    record.last_run = previous.last_run.clone();
    file.schedules[index] = record.clone();
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

#[tauri::command]
async fn schedule_delete(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<()> {
    let _lock = state.schedule_lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let before = file.schedules.len();
    file.schedules.retain(|schedule| schedule.id != id);
    if file.schedules.len() == before {
        return Err(schedule_error("schedule not found"));
    }
    scheduler::save(&home, &file).map_err(schedule_file_error)
}

#[tauri::command]
async fn schedule_run_now(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<scheduler::ScheduleRecord> {
    let _lock = state.schedule_lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let index = file
        .schedules
        .iter()
        .position(|schedule| schedule.id == id)
        .ok_or_else(|| schedule_error("schedule not found"))?;
    let mut record = file.schedules[index].clone();
    let now = Utc::now();
    let result = dispatch_schedule(&app, &record).await;
    record.last_run = Some(scheduler::ScheduleRun {
        at: now.to_rfc3339(),
        success: result.is_ok(),
        message: result.as_ref().map(|_| "dispatched".to_string()).unwrap_or_else(|error| error.clone()),
    });
    if let Ok(Some(thread_id)) = result {
        record.thread_id = Some(thread_id);
    }
    if let Some(next) = scheduler::next_after_run(&record.cadence, now) {
        record.next_run_at = next.to_rfc3339();
    } else {
        record.enabled = false;
    }
    file.schedules[index] = record.clone();
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

async fn run_due_schedules(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let _lock = state.schedule_lock.lock().await;
    let home = desktop_ruxex_home()?;
    let mut file = scheduler::load(&home)?;
    let now = Utc::now();
    let due_ids = file
        .schedules
        .iter()
        .filter(|schedule| {
            schedule.enabled
                && chrono::DateTime::parse_from_rfc3339(&schedule.next_run_at)
                    .map(|next| next.with_timezone(&Utc) <= now)
                    .unwrap_or(false)
        })
        .map(|schedule| schedule.id.clone())
        .collect::<Vec<_>>();
    for id in &due_ids {
        let Some(index) = file.schedules.iter().position(|schedule| schedule.id == *id) else {
            continue;
        };
        let mut record = file.schedules[index].clone();
        let result = dispatch_schedule(app, &record).await;
        record.last_run = Some(scheduler::ScheduleRun {
            at: now.to_rfc3339(),
            success: result.is_ok(),
            message: result.as_ref().map(|_| "dispatched".to_string()).unwrap_or_else(|error| error.clone()),
        });
        if let Ok(Some(thread_id)) = result {
            record.thread_id = Some(thread_id);
        }
        if let Some(next) = scheduler::next_after_run(&record.cadence, now) {
            record.next_run_at = next.to_rfc3339();
        } else {
            record.enabled = false;
        }
        file.schedules[index] = record;
    }
    if !due_ids.is_empty() {
        scheduler::save(&home, &file)?;
    }
    Ok(())
}

async fn dispatch_schedule(app: &AppHandle, schedule: &scheduler::ScheduleRecord) -> Result<Option<String>, String> {
    let state = app.state::<AppState>();
    let handle = request_handle(&state)
        .await
        .map_err(|error| error.message)?;
    let thread_id = if let Some(thread_id) = &schedule.thread_id {
        let request = schedule_request(
            "thread/resume",
            serde_json::json!({ "threadId": thread_id, "excludeTurns": true }),
        )?;
        send_schedule_request(&handle, request).await?;
        Some(thread_id.clone())
    } else {
        let request = schedule_request("thread/start", serde_json::json!({}))?;
        let response = send_schedule_request(&handle, request).await?;
        response
            .get("thread")
            .and_then(|thread| thread.get("id"))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| "thread/start response did not include a thread id".to_string())
            .map(Some)?
    };
    let request = schedule_request(
        "turn/start",
        serde_json::json!({
            "threadId": thread_id.as_deref().unwrap_or_default(),
            "input": [{ "type": "text", "text": schedule.prompt, "text_elements": [] }]
        }),
    )?;
    send_schedule_request(&handle, request).await?;
    Ok(thread_id)
}

fn schedule_request(method: &str, params: Value) -> Result<ClientRequest, String> {
    serde_json::from_value(serde_json::json!({
        "method": method,
        "id": next_schedule_request_id(),
        "params": params,
    }))
    .map_err(|error| format!("failed to build {method} request: {error}"))
}

async fn send_schedule_request(
    handle: &AppServerRequestHandle,
    request: ClientRequest,
) -> Result<Value, String> {
    let method = request.method_name();
    handle
        .request(request)
        .await
        .map_err(|error| format!("{method} transport error: {error}"))?
        .map_err(|error| format!("{method} failed: {} (code {})", error.message, error.code))
}

#[tauri::command]
fn worktree_list(root: String) -> CommandResult<Vec<worktree::WorktreeRecord>> {
    worktree::list(Path::new(&root)).map_err(schedule_error)
}

#[tauri::command]
fn worktree_create(
    request: worktree::WorktreeCreateRequest,
) -> CommandResult<worktree::WorktreeRecord> {
    worktree::create(&request).map_err(schedule_error)
}

#[tauri::command]
fn worktree_remove(request: worktree::WorktreeRemoveRequest) -> CommandResult<()> {
    worktree::remove(&request).map_err(schedule_error)
}

#[tauri::command]
fn worktree_open(root: String, path: String) -> CommandResult<()> {
    let exists = worktree::list(Path::new(&root))
        .map_err(schedule_error)?
        .into_iter()
        .any(|worktree| worktree.path == path);
    if !exists {
        return Err(schedule_error("worktree path is not registered in the repository"));
    }
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to open worktree: {error}"),
        )
    })
}

async fn connect_unix_socket(
    socket_path: AbsolutePathBuf,
) -> Result<RemoteAppServerClient, std::io::Error> {
    RemoteAppServerClient::connect(RemoteAppServerConnectArgs {
        endpoint: RemoteAppServerEndpoint::UnixSocket { socket_path },
        client_name: desktop_product_identity().product_name().to_string(),
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
        client_name: desktop_product_identity().product_name().to_string(),
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
    state: &State<'_, AppState>,
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

async fn connect_local_endpoint(app: &AppHandle) -> CommandResult<(RemoteAppServerClient, AppServerStatus)> {
    let home = desktop_ruxex_home()
        .map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_path = ruxex_app_server_client::app_server_control_socket_path(&home).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
    })?;
    let (client, effective_socket_path, bootstrapped_version) = match connect_unix_socket(socket_path.clone()).await {
        Ok(client) => (client, socket_path, None),
        Err(_) => {
            let package_source = runtime_package_source(app)
                .map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
            let bootstrap = ruxex_app_server_daemon::bootstrap_from_package_with_host_args(
                &package_source,
                &[
                    OsString::from(ruxex_app_server_daemon::HOST_APP_SERVER_DAEMON_MODE_ARG),
                    OsString::from("--managed-daemon"),
                ],
            )
            .await
            .map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, format!("{error:#}")))?;
            let effective_socket_path = AbsolutePathBuf::from_absolute_path(bootstrap.socket_path.clone())
                .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error.to_string()))?;
            let client = connect_unix_socket(effective_socket_path.clone()).await.map_err(|error| {
                command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
            })?;
            (client, effective_socket_path, Some(bootstrap.app_server_version))
        }
    };
    let status = AppServerStatus {
        socket_path: effective_socket_path.display().to_string(),
        app_server_version: client.server_version().map(str::to_owned).or(bootstrapped_version).unwrap_or_else(|| "unknown".to_string()),
        endpoint_kind: AppServerEndpointKind::Local,
    };
    Ok((client, status))
}

#[tauri::command]
async fn connect_app_server(
    app: AppHandle,
    state: State<'_, AppState>,
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
async fn disconnect_app_server(state: State<'_, AppState>) -> CommandResult<()> {
    let _initialization = state.initialization.lock().await;
    if let Some(sender) = state.shutdown.lock().await.take() {
        let _ = sender.send(()).await;
    }
    *state.request_handle.lock().await = None;
    *state.status.lock().await = None;
    Ok(())
}

#[tauri::command]
async fn app_server_connection_status(
    state: State<'_, AppState>,
) -> CommandResult<Option<AppServerStatus>> {
    Ok(state.status.lock().await.clone())
}

#[tauri::command]
async fn ensure_app_server(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<AppServerStatus> {
    let _initialization = state.initialization.lock().await;
    if let Some(status) = state.status.lock().await.clone() {
        return Ok(status);
    }
    let (client, status) = connect_local_endpoint(&app).await?;
    install_connection(&app, &state, client, status).await
}

#[tauri::command]
async fn app_server_request(
    state: State<'_, AppState>,
    request: ClientRequest,
) -> CommandResult<ClientResponse> {
    let request_handle = request_handle(&state).await?;
    let method = request.method_name();
    let request_id = request.id().clone();
    let result = request_handle
        .request(request)
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Transport,
                format!("{method} transport error: {error}"),
            )
        })?
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Server,
                format!("{method} failed: {} (code {})", error.message, error.code),
            )
        })?;

    let response = serde_json::json!({
        "method": method,
        "id": request_id,
        "response": result,
    });
    serde_json::from_value(response).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("{method} response decode error: {error}"),
        )
    })
}

#[tauri::command]
async fn app_server_resolve_server_request(
    state: State<'_, AppState>,
    request_id: RequestId,
    result: JsonRpcResult,
) -> CommandResult<()> {
    request_handle(&state)
        .await?
        .resolve_server_request(request_id, result)
        .await
        .map_err(|error| command_error(DesktopAppServerErrorKind::Transport, error.to_string()))?;
    Ok(())
}

#[tauri::command]
async fn app_server_reject_server_request(
    state: State<'_, AppState>,
    request_id: RequestId,
    error: JSONRPCErrorError,
) -> CommandResult<()> {
    request_handle(&state)
        .await?
        .reject_server_request(request_id, error)
        .await
        .map_err(|error| command_error(DesktopAppServerErrorKind::Transport, error.to_string()))?;
    Ok(())
}

async fn request_handle(state: &State<'_, AppState>) -> CommandResult<AppServerRequestHandle> {
    state.request_handle.lock().await.clone().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Connection,
            "app-server is not connected",
        )
    })
}

fn runtime_package_source(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_package = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve application resources: {error}"))?
        .join("ruxex-package");
    let development_package = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("ruxex-package");
    select_runtime_package(&resource_package, &development_package)
}

fn select_runtime_package(resource_package: &Path, development_package: &Path) -> Result<PathBuf, String> {
    if resource_package.join("ruxex-package.json").is_file() {
        return Ok(resource_package.to_path_buf());
    }
    if development_package.join("ruxex-package.json").is_file() {
        return Ok(development_package.to_path_buf());
    }
    Err(format!(
        "bundled Ruxex runtime package not found at {} or {}",
        resource_package.display(),
        development_package.display()
    ))
}
