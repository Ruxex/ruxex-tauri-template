use std::collections::HashSet;
use std::future::Future;
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};

use chrono::{DateTime, Utc};
use ruxex_app_server_client::AppServerRequestHandle;
use ruxex_app_server_protocol::ClientRequest;
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::app_server::{AppServerState, request_handle};
use crate::desktop::ruxex_home;
use crate::error::{
    CommandResult, DesktopAppServerError, DesktopAppServerErrorKind, command_error,
};
use crate::scheduler::{self, ScheduleInput, ScheduleRecord};

static NEXT_SCHEDULE_REQUEST_ID: AtomicI64 = AtomicI64::new(10_000_000);

#[derive(Default)]
pub(crate) struct ScheduleState {
    lock: tauri::async_runtime::Mutex<ScheduleStateInner>,
}

#[derive(Default)]
struct ScheduleStateInner {
    in_flight: HashSet<String>,
}

#[derive(Clone, Copy)]
enum RunMode {
    Manual,
    Due(DateTime<Utc>),
}

enum RunScheduleOutcome {
    Completed(Box<ScheduleRecord>),
    Missing,
    Skipped,
}

fn schedule_error(message: impl Into<String>) -> DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}

fn schedule_home() -> Result<std::path::PathBuf, DesktopAppServerError> {
    ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))
}

fn schedule_file_error(message: String) -> DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}

#[tauri::command]
pub(crate) async fn schedule_list(
    state: State<'_, ScheduleState>,
) -> CommandResult<Vec<ScheduleRecord>> {
    let _guard = state.lock.lock().await;
    let home = schedule_home()?;
    Ok(scheduler::load(&home)
        .map_err(schedule_file_error)?
        .schedules)
}

#[tauri::command]
pub(crate) async fn schedule_create(
    state: State<'_, ScheduleState>,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let _guard = state.lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let id = format!(
        "schedule-{}-{}",
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let record = scheduler::new_record(id, input, Utc::now()).map_err(schedule_error)?;
    file.schedules.push(record.clone());
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

#[tauri::command]
pub(crate) async fn schedule_update(
    state: State<'_, ScheduleState>,
    id: String,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let _guard = state.lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let index = file
        .schedules
        .iter()
        .position(|schedule| schedule.id == id)
        .ok_or_else(|| schedule_error("schedule not found"))?;
    let record = scheduler::updated_record(&file.schedules[index], input, Utc::now())
        .map_err(schedule_error)?;
    file.schedules[index] = record.clone();
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

#[tauri::command]
pub(crate) async fn schedule_set_enabled(
    state: State<'_, ScheduleState>,
    id: String,
    enabled: bool,
) -> CommandResult<ScheduleRecord> {
    let _guard = state.lock.lock().await;
    let home = schedule_home()?;
    let mut file = scheduler::load(&home).map_err(schedule_file_error)?;
    let index = file
        .schedules
        .iter()
        .position(|schedule| schedule.id == id)
        .ok_or_else(|| schedule_error("schedule not found"))?;
    file.schedules[index].enabled = enabled;
    let record = file.schedules[index].clone();
    scheduler::save(&home, &file).map_err(schedule_file_error)?;
    Ok(record)
}

#[tauri::command]
pub(crate) async fn schedule_delete(
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<()> {
    let _guard = state.lock.lock().await;
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
pub(crate) async fn schedule_run_now(
    app: AppHandle,
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    match run_schedule_with(&home, &state, &id, RunMode::Manual, |schedule| {
        dispatch_schedule(&app, schedule)
    })
    .await
    .map_err(schedule_file_error)?
    {
        RunScheduleOutcome::Completed(record) => Ok(*record),
        RunScheduleOutcome::Missing => Err(schedule_error(
            "schedule not found or was deleted during dispatch",
        )),
        RunScheduleOutcome::Skipped => Err(schedule_error("schedule is already running")),
    }
}

pub(crate) async fn run_due_schedules(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<ScheduleState>();
    let home = ruxex_home()?;
    let now = Utc::now();
    let due_ids = {
        let _guard = state.lock.lock().await;
        scheduler::load(&home)?
            .schedules
            .into_iter()
            .filter(|schedule| is_due(schedule, now))
            .map(|schedule| schedule.id)
            .collect::<Vec<_>>()
    };

    for id in due_ids {
        run_schedule_with(&home, &state, &id, RunMode::Due(now), |schedule| {
            dispatch_schedule(app, schedule)
        })
        .await?;
    }
    Ok(())
}

async fn run_schedule_with<F, Fut>(
    home: &Path,
    state: &ScheduleState,
    id: &str,
    mode: RunMode,
    dispatch: F,
) -> Result<RunScheduleOutcome, String>
where
    F: FnOnce(ScheduleRecord) -> Fut,
    Fut: Future<Output = Result<Option<String>, String>>,
{
    let snapshot = {
        let mut guard = state.lock.lock().await;
        let Some(snapshot) = scheduler::load(home)?
            .schedules
            .into_iter()
            .find(|schedule| schedule.id == id)
        else {
            return Ok(RunScheduleOutcome::Missing);
        };
        if let RunMode::Due(now) = mode
            && !is_due(&snapshot, now)
        {
            return Ok(RunScheduleOutcome::Skipped);
        }
        if !guard.in_flight.insert(id.to_string()) {
            return Ok(RunScheduleOutcome::Skipped);
        }
        snapshot
    };
    let started_at = Utc::now();
    let result = dispatch(snapshot).await;

    let mut guard = state.lock.lock().await;
    let finalization = (|| {
        let mut file = scheduler::load(home)?;
        let Some(index) = file.schedules.iter().position(|schedule| schedule.id == id) else {
            return Ok(RunScheduleOutcome::Missing);
        };
        let record = scheduler::apply_run_result(&file.schedules[index], started_at, result);
        file.schedules[index] = record.clone();
        scheduler::save(home, &file)?;
        Ok(RunScheduleOutcome::Completed(Box::new(record)))
    })();
    guard.in_flight.remove(id);
    finalization
}

fn is_due(schedule: &ScheduleRecord, now: DateTime<Utc>) -> bool {
    schedule.enabled
        && chrono::DateTime::parse_from_rfc3339(&schedule.next_run_at)
            .map(|next| next.with_timezone(&Utc) <= now)
            .unwrap_or(false)
}

async fn dispatch_schedule(
    app: &AppHandle,
    schedule: ScheduleRecord,
) -> Result<Option<String>, String> {
    let state = app.state::<AppServerState>();
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

fn next_schedule_request_id() -> i64 {
    NEXT_SCHEDULE_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};

    use chrono::{DateTime, Duration, Utc};
    use tokio::sync::Notify;

    use super::{RunMode, RunScheduleOutcome, ScheduleState, run_schedule_with};
    use crate::scheduler::{
        ScheduleCadence, ScheduleFile, ScheduleInput, load, new_record, save, updated_record,
    };

    fn now() -> DateTime<Utc> {
        "2026-10-21T10:15:00Z".parse().unwrap()
    }

    fn fixture(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "ruxex-schedule-commands-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn input(name: &str) -> ScheduleInput {
        ScheduleInput {
            name: name.to_string(),
            prompt: "run checks".to_string(),
            thread_id: None,
            cadence: ScheduleCadence::Daily {
                hour: 12,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            },
            enabled: true,
        }
    }

    fn store_record(home: &Path, name: &str) {
        let record = new_record("schedule-1".to_string(), input(name), now()).unwrap();
        save(
            home,
            &ScheduleFile {
                schedules: vec![record],
                ..ScheduleFile::default()
            },
        )
        .unwrap();
    }

    fn completed(outcome: RunScheduleOutcome) -> crate::scheduler::ScheduleRecord {
        match outcome {
            RunScheduleOutcome::Completed(record) => *record,
            RunScheduleOutcome::Missing | RunScheduleOutcome::Skipped => {
                panic!("expected completed schedule run")
            }
        }
    }

    #[test]
    fn dispatch_runs_without_holding_schedule_lock() {
        tauri::async_runtime::block_on(async {
            let home = fixture("unlocked");
            let state = ScheduleState::default();
            store_record(&home, "Original");

            let result =
                run_schedule_with(&home, &state, "schedule-1", RunMode::Manual, |_| async {
                    assert!(state.lock.try_lock().is_ok());
                    Ok(None)
                })
                .await
                .unwrap();

            assert!(matches!(result, RunScheduleOutcome::Completed(_)));
            let _ = fs::remove_dir_all(home);
        });
    }

    #[test]
    fn finalization_preserves_an_edit_made_during_dispatch() {
        tauri::async_runtime::block_on(async {
            let home = fixture("edit");
            let state = ScheduleState::default();
            store_record(&home, "Original");

            let result =
                run_schedule_with(&home, &state, "schedule-1", RunMode::Manual, |_| async {
                    let _guard = state.lock.lock().await;
                    let mut file = load(&home).unwrap();
                    file.schedules[0] =
                        updated_record(&file.schedules[0], input("Edited during dispatch"), now())
                            .unwrap();
                    save(&home, &file).unwrap();
                    Ok(Some("thread-created".to_string()))
                })
                .await
                .map(completed)
                .unwrap();

            assert_eq!(result.name, "Edited during dispatch");
            assert_eq!(result.thread_id.as_deref(), Some("thread-created"));
            assert!(result.last_run.is_some());
            let _ = fs::remove_dir_all(home);
        });
    }

    #[test]
    fn finalization_does_not_recreate_a_deleted_schedule() {
        tauri::async_runtime::block_on(async {
            let home = fixture("delete");
            let state = ScheduleState::default();
            store_record(&home, "Original");

            let result =
                run_schedule_with(&home, &state, "schedule-1", RunMode::Manual, |_| async {
                    let _guard = state.lock.lock().await;
                    save(&home, &ScheduleFile::default()).unwrap();
                    Ok(None)
                })
                .await
                .unwrap();

            assert!(matches!(result, RunScheduleOutcome::Missing));
            assert!(load(&home).unwrap().schedules.is_empty());
            let _ = fs::remove_dir_all(home);
        });
    }

    #[test]
    fn manual_and_due_runs_apply_the_same_transition() {
        tauri::async_runtime::block_on(async {
            let manual_home = fixture("manual-transition");
            let due_home = fixture("due-transition");
            let manual_state = ScheduleState::default();
            let due_state = ScheduleState::default();
            store_record(&manual_home, "Manual");
            store_record(&due_home, "Due");

            let manual = run_schedule_with(
                &manual_home,
                &manual_state,
                "schedule-1",
                RunMode::Manual,
                |_| async { Err("offline".to_string()) },
            )
            .await
            .map(completed)
            .unwrap();
            let due = run_schedule_with(
                &due_home,
                &due_state,
                "schedule-1",
                RunMode::Due(now() + Duration::days(1)),
                |_| async { Err("offline".to_string()) },
            )
            .await
            .map(completed)
            .unwrap();

            assert_eq!(manual.last_run.unwrap().message, "offline");
            assert_eq!(due.last_run.unwrap().message, "offline");
            assert_eq!(manual.next_run_at, due.next_run_at);
            let _ = fs::remove_dir_all(manual_home);
            let _ = fs::remove_dir_all(due_home);
        });
    }

    #[test]
    fn due_run_rechecks_enabled_state_after_candidate_scan() {
        tauri::async_runtime::block_on(async {
            let home = fixture("due-recheck");
            let state = ScheduleState::default();
            store_record(&home, "Due");

            {
                let _guard = state.lock.lock().await;
                let mut file = load(&home).unwrap();
                file.schedules[0].enabled = false;
                save(&home, &file).unwrap();
            }

            let dispatched = AtomicBool::new(false);
            let outcome = run_schedule_with(
                &home,
                &state,
                "schedule-1",
                RunMode::Due(now() + Duration::days(1)),
                |_| async {
                    dispatched.store(true, Ordering::SeqCst);
                    Ok(None)
                },
            )
            .await
            .unwrap();

            assert!(matches!(outcome, RunScheduleOutcome::Skipped));
            assert!(!dispatched.load(Ordering::SeqCst));
            let _ = fs::remove_dir_all(home);
        });
    }

    #[test]
    fn manual_and_due_runs_claim_the_schedule_once() {
        tauri::async_runtime::block_on(async {
            let home = fixture("in-flight");
            let state = ScheduleState::default();
            store_record(&home, "Due");
            let started = Arc::new(Notify::new());
            let release = Arc::new(Notify::new());
            let second_dispatched = AtomicBool::new(false);

            let first_started = Arc::clone(&started);
            let first_release = Arc::clone(&release);
            let first = run_schedule_with(
                &home,
                &state,
                "schedule-1",
                RunMode::Manual,
                move |_| async move {
                    first_started.notify_one();
                    first_release.notified().await;
                    Ok(None)
                },
            );
            let second = async {
                started.notified().await;
                let outcome = run_schedule_with(
                    &home,
                    &state,
                    "schedule-1",
                    RunMode::Due(now() + Duration::days(1)),
                    |_| async {
                        second_dispatched.store(true, Ordering::SeqCst);
                        Ok(None)
                    },
                )
                .await;
                release.notify_one();
                outcome
            };

            let (first, second) = futures::join!(first, second);
            assert!(matches!(first.unwrap(), RunScheduleOutcome::Completed(_)));
            assert!(matches!(second.unwrap(), RunScheduleOutcome::Skipped));
            assert!(!second_dispatched.load(Ordering::SeqCst));
            let _ = fs::remove_dir_all(home);
        });
    }
}
