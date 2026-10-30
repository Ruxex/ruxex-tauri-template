use std::fs::{self, OpenOptions};
use std::future::Future;
use std::io::{self, Write};
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};

use ruxex::desktop::client::AppServerRequestHandle;
use ruxex::desktop::protocol::ClientRequest;
use serde::Serialize;
use serde_json::{Value, json};

use crate::ScheduleRecord;

static NEXT_REQUEST_ID: AtomicI64 = AtomicI64::new(10_000_000);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppServerLogDirection {
    ToAppServer,
    FromAppServer,
}

pub fn format_app_server_log(direction: AppServerLogDirection, payload: &Value) -> String {
    format_app_server_log_line(direction, payload, true)
}

fn format_app_server_log_line(
    direction: AppServerLogDirection,
    payload: &Value,
    colorize: bool,
) -> String {
    let (color, header) = match direction {
        AppServerLogDirection::ToAppServer => (36, "[tauri→]"),
        AppServerLogDirection::FromAppServer => (32, "[←app]"),
    };
    let payload = serde_json::to_string(payload).unwrap_or_else(|error| {
        format!(
            "{{\"loggingError\":\"failed to serialize log payload: {}\"}}",
            error
        )
    });
    if colorize {
        format!("\x1b[{color}m{header}\x1b[0m {payload}")
    } else {
        format!("{header} {payload}")
    }
}

fn write_app_server_log<T: Serialize>(
    path: &Path,
    direction: AppServerLogDirection,
    payload: &T,
) -> io::Result<()> {
    let payload = serde_json::to_value(payload).unwrap_or_else(|error| {
        serde_json::json!({
            "loggingError": format!("failed to serialize log payload: {error}"),
        })
    });
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(
        file,
        "{}",
        format_app_server_log_line(direction, &payload, false)
    )
}

pub fn log_app_server_io<T: Serialize>(direction: AppServerLogDirection, payload: &T) {
    #[cfg(debug_assertions)]
    {
        let payload = serde_json::to_value(payload).unwrap_or_else(|error| {
            serde_json::json!({
                "loggingError": format!("failed to serialize log payload: {error}"),
            })
        });
        println!("{}", format_app_server_log(direction, &payload));
        let log_directory = Path::new("logs");
        if fs::create_dir_all(log_directory).is_ok() {
            let path = log_directory.join("app-server-jrpc.log");
            let _ = write_app_server_log(&path, direction, &payload);
        }
    }

    #[cfg(not(debug_assertions))]
    let _ = (direction, payload);
}

pub trait ScheduleDispatcher {
    fn dispatch(
        &self,
        schedule: ScheduleRecord,
    ) -> impl Future<Output = Result<Option<String>, String>> + Send;
}

pub struct AppServerDispatcher<'a> {
    handle: &'a AppServerRequestHandle,
}

impl<'a> AppServerDispatcher<'a> {
    pub fn new(handle: &'a AppServerRequestHandle) -> Self {
        Self { handle }
    }
}

impl ScheduleDispatcher for AppServerDispatcher<'_> {
    fn dispatch(
        &self,
        schedule: ScheduleRecord,
    ) -> impl Future<Output = Result<Option<String>, String>> + Send {
        async move {
            let thread_id = if let Some(thread_id) = &schedule.thread_id {
                send_request(self.handle, build_thread_request(Some(thread_id))?).await?;
                thread_id.clone()
            } else {
                let response = send_request(self.handle, build_thread_request(None)?).await?;
                response
                    .get("thread")
                    .and_then(|thread| thread.get("id"))
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .ok_or_else(|| {
                        "thread/start response did not include a thread id".to_string()
                    })?
            };

            send_request(
                self.handle,
                build_turn_request(&thread_id, &schedule.prompt)?,
            )
            .await?;
            Ok(Some(thread_id))
        }
    }
}

pub fn build_thread_request(thread_id: Option<&str>) -> Result<ClientRequest, String> {
    match thread_id {
        Some(thread_id) => schedule_request(
            "thread/resume",
            serde_json::json!({ "threadId": thread_id, "excludeTurns": true }),
        ),
        None => schedule_request("thread/start", serde_json::json!({})),
    }
}

pub fn build_turn_request(thread_id: &str, prompt: &str) -> Result<ClientRequest, String> {
    schedule_request(
        "turn/start",
        serde_json::json!({
            "threadId": thread_id,
            "input": [{ "type": "text", "text": prompt, "text_elements": [] }]
        }),
    )
}

fn next_request_id() -> i64 {
    NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
}

fn schedule_request(method: &str, params: Value) -> Result<ClientRequest, String> {
    serde_json::from_value(serde_json::json!({
        "method": method,
        "id": next_request_id(),
        "params": params,
    }))
    .map_err(|error| format!("failed to build {method} request: {error}"))
}

async fn send_request(
    handle: &AppServerRequestHandle,
    request: ClientRequest,
) -> Result<Value, String> {
    let method = request.method_name();
    let request_id = request.id().clone();
    log_app_server_io(AppServerLogDirection::ToAppServer, &request);

    let result = match handle.request(request).await {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => {
            let message = format!("{method} failed: {} (code {})", error.message, error.code);
            log_app_server_io(
                AppServerLogDirection::FromAppServer,
                &json!({
                    "method": method,
                    "id": request_id,
                    "error": { "message": error.message, "code": error.code },
                }),
            );
            return Err(message);
        }
        Err(error) => {
            let message = format!("{method} transport error: {error}");
            log_app_server_io(
                AppServerLogDirection::FromAppServer,
                &json!({
                    "method": method,
                    "id": request_id,
                    "error": { "kind": "transport", "message": message },
                }),
            );
            return Err(message);
        }
    };

    log_app_server_io(
        AppServerLogDirection::FromAppServer,
        &json!({ "method": method, "id": request_id, "response": result }),
    );
    Ok(result)
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::{AppServerLogDirection, format_app_server_log, write_app_server_log};
    use crate::{
        ScheduleCadence, ScheduleDispatcher, ScheduleFile, ScheduleInput, ScheduleRecord,
        SchedulerState, build_thread_request, build_turn_request, load, new_record, save,
    };
    use chrono::Utc;

    struct FakeDispatcher {
        result: Mutex<Result<Option<String>, String>>,
        calls: Arc<Mutex<Vec<String>>>,
    }

    struct BlockingDispatcher {
        entered: Arc<tokio::sync::Notify>,
        release: Arc<tokio::sync::Notify>,
    }

    impl ScheduleDispatcher for BlockingDispatcher {
        fn dispatch(
            &self,
            _schedule: ScheduleRecord,
        ) -> impl std::future::Future<Output = Result<Option<String>, String>> + Send {
            let entered = self.entered.clone();
            let release = self.release.clone();
            async move {
                entered.notify_one();
                release.notified().await;
                Ok(None)
            }
        }
    }

    impl ScheduleDispatcher for FakeDispatcher {
        fn dispatch(
            &self,
            schedule: ScheduleRecord,
        ) -> impl std::future::Future<Output = Result<Option<String>, String>> + Send {
            let calls = self.calls.clone();
            let result = self.result.lock().unwrap().clone();
            async move {
                calls.lock().unwrap().push(schedule.id);
                result
            }
        }
    }

    fn schedule(id: &str, next_run_at: &str) -> ScheduleRecord {
        ScheduleRecord {
            id: id.to_string(),
            name: "Checks".to_string(),
            prompt: "run checks".to_string(),
            thread_id: None,
            cadence: ScheduleCadence::Daily {
                hour: 9,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            },
            next_run_at: next_run_at.to_string(),
            enabled: true,
            last_run: None,
        }
    }

    #[test]
    fn formats_colored_app_server_direction_headers() {
        assert_eq!(
            format_app_server_log(
                AppServerLogDirection::ToAppServer,
                &serde_json::json!({ "method": "thread/start" }),
            ),
            "\x1b[36m[tauri→]\x1b[0m {\"method\":\"thread/start\"}",
        );
        assert_eq!(
            format_app_server_log(
                AppServerLogDirection::FromAppServer,
                &serde_json::json!({ "type": "serverNotification" }),
            ),
            "\x1b[32m[←app]\x1b[0m {\"type\":\"serverNotification\"}",
        );
    }

    #[test]
    fn writes_plain_app_server_log_lines_to_a_file() {
        let path = std::env::temp_dir().join(format!(
            "ruxex-scheduler-jrpc-log-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default(),
        ));

        write_app_server_log(
            &path,
            AppServerLogDirection::ToAppServer,
            &serde_json::json!({ "method": "turn/start" }),
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "[tauri→] {\"method\":\"turn/start\"}\n",
        );
        std::fs::remove_file(path).unwrap();
    }

    fn home(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("ruxex-scheduler-{label}-{}", std::process::id()))
    }

    #[test]
    fn builds_start_resume_and_turn_requests() {
        assert_eq!(
            build_thread_request(None).unwrap().method_name(),
            "thread/start"
        );
        assert_eq!(
            build_thread_request(Some("thread-1"))
                .unwrap()
                .method_name(),
            "thread/resume"
        );
        assert_eq!(
            build_turn_request("thread-1", "run checks")
                .unwrap()
                .method_name(),
            "turn/start"
        );
    }

    #[tokio::test]
    async fn run_now_persists_dispatch_result_and_created_thread() {
        let home = home("run-now");
        let record = schedule("schedule-1", "2099-01-01T00:00:00Z");
        save(
            &home,
            &ScheduleFile {
                schedules: vec![record],
                ..ScheduleFile::default()
            },
        )
        .unwrap();
        let calls = Arc::new(Mutex::new(Vec::new()));
        let dispatcher = FakeDispatcher {
            result: Mutex::new(Ok(Some("thread-1".to_string()))),
            calls: calls.clone(),
        };

        let updated = SchedulerState::default()
            .run_now(&home, "schedule-1", Some(&dispatcher))
            .await
            .unwrap();

        assert_eq!(updated.thread_id.as_deref(), Some("thread-1"));
        assert!(updated.last_run.unwrap().success);
        assert_eq!(&*calls.lock().unwrap(), &["schedule-1"]);
        assert_eq!(
            load(&home).unwrap().schedules[0].thread_id.as_deref(),
            Some("thread-1")
        );
    }

    #[tokio::test]
    async fn run_due_records_dispatch_failure_without_aborting() {
        let home = home("failed-due");
        save(
            &home,
            &ScheduleFile {
                schedules: vec![schedule("schedule-1", "2020-01-01T00:00:00Z")],
                ..ScheduleFile::default()
            },
        )
        .unwrap();
        let dispatcher = FakeDispatcher {
            result: Mutex::new(Err("app server unavailable".to_string())),
            calls: Arc::new(Mutex::new(Vec::new())),
        };

        SchedulerState::default()
            .run_due(&home, Some(&dispatcher))
            .await
            .unwrap();

        let saved = load(&home).unwrap().schedules.remove(0);
        assert!(!saved.last_run.unwrap().success);
    }

    #[tokio::test]
    async fn suppresses_duplicate_dispatch_and_does_not_recreate_deleted_schedule() {
        let home = home("concurrent");
        save(
            &home,
            &ScheduleFile {
                schedules: vec![schedule("schedule-1", "2099-01-01T00:00:00Z")],
                ..ScheduleFile::default()
            },
        )
        .unwrap();
        let state = std::sync::Arc::new(SchedulerState::default());
        let entered = Arc::new(tokio::sync::Notify::new());
        let release = Arc::new(tokio::sync::Notify::new());
        let dispatcher = Arc::new(BlockingDispatcher {
            entered: entered.clone(),
            release: release.clone(),
        });
        let first_state = state.clone();
        let first_home = home.clone();
        let first_dispatcher = dispatcher.clone();
        let first = tokio::spawn(async move {
            first_state
                .run_now(&first_home, "schedule-1", Some(first_dispatcher.as_ref()))
                .await
        });
        entered.notified().await;

        let duplicate = state
            .run_now(&home, "schedule-1", Some(dispatcher.as_ref()))
            .await;
        assert_eq!(duplicate.unwrap_err(), "schedule is already running");

        state.delete(&home, "schedule-1").await.unwrap();
        release.notify_one();
        assert_eq!(
            first.await.unwrap().unwrap_err(),
            "schedule not found or was deleted during dispatch"
        );
        assert!(load(&home).unwrap().schedules.is_empty());
    }

    #[test]
    fn test_input_compiles_against_shared_schedule_model() {
        let _ = new_record(
            "schedule-1".to_string(),
            ScheduleInput {
                name: "Checks".to_string(),
                prompt: "run checks".to_string(),
                thread_id: None,
                cadence: ScheduleCadence::Daily {
                    hour: 9,
                    minute: 0,
                    time_zone: Some("UTC".to_string()),
                },
                enabled: true,
            },
            Utc::now(),
        );
    }
}
