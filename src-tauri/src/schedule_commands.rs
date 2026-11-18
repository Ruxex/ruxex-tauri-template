use ruxex_scheduler::{ScheduleInput, ScheduleRecord};
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::app_server::{AppServerState, request_handle};
use crate::desktop::ruxex_home;
use crate::error::{
    CommandResult, DesktopAppServerError, DesktopAppServerErrorKind, command_error,
};
use crate::scheduler_app_server::AppServerDispatcher;

pub(crate) use ruxex_scheduler::SchedulerState as ScheduleState;

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
    let home = schedule_home()?;
    schedule_list_at(&state, &home).await
}

async fn schedule_list_at(
    state: &ScheduleState,
    home: &Path,
) -> CommandResult<Vec<ScheduleRecord>> {
    state.list(home).await.map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_create(
    state: State<'_, ScheduleState>,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    schedule_create_at(&state, &home, input).await
}

async fn schedule_create_at(
    state: &ScheduleState,
    home: &Path,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    state.create(home, input).await.map_err(schedule_error)
}

#[tauri::command]
pub(crate) async fn schedule_update(
    state: State<'_, ScheduleState>,
    id: String,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    schedule_update_at(&state, &home, &id, input).await
}

async fn schedule_update_at(
    state: &ScheduleState,
    home: &Path,
    id: &str,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    state.update(home, id, input).await.map_err(schedule_error)
}

#[tauri::command]
pub(crate) async fn schedule_set_enabled(
    state: State<'_, ScheduleState>,
    id: String,
    enabled: bool,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    schedule_set_enabled_at(&state, &home, &id, enabled).await
}

async fn schedule_set_enabled_at(
    state: &ScheduleState,
    home: &Path,
    id: &str,
    enabled: bool,
) -> CommandResult<ScheduleRecord> {
    state
        .set_enabled(home, id, enabled)
        .await
        .map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_delete(
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<()> {
    let home = schedule_home()?;
    schedule_delete_at(&state, &home, &id).await
}

async fn schedule_delete_at(state: &ScheduleState, home: &Path, id: &str) -> CommandResult<()> {
    state.delete(home, id).await.map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_run_now<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    let app_server = app.state::<AppServerState>();
    let handle = request_handle(&app_server).await.ok();
    let dispatcher = handle.as_ref().map(AppServerDispatcher::new);
    schedule_run_now_at(&state, &home, &id, dispatcher.as_ref()).await
}

async fn schedule_run_now_at(
    state: &ScheduleState,
    home: &Path,
    id: &str,
    dispatcher: Option<&AppServerDispatcher<'_>>,
) -> CommandResult<ScheduleRecord> {
    state
        .run_now(home, id, dispatcher)
        .await
        .map_err(schedule_error)
}

pub(crate) async fn run_due_schedules<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let home = ruxex_home()?;
    let state = app.state::<ScheduleState>();
    let app_server = app.state::<AppServerState>();
    let handle = request_handle(&app_server).await.ok();
    let dispatcher = handle.as_ref().map(AppServerDispatcher::new);
    state.run_due(&home, dispatcher.as_ref()).await
}

#[cfg(test)]
mod tests {
    use super::{
        ScheduleInput, ScheduleState, schedule_create_at, schedule_delete_at, schedule_list_at,
        schedule_run_now_at, schedule_set_enabled_at, schedule_update_at,
    };
    use crate::app_server::AppServerState;
    use crate::desktop::{TEST_RUXEX_HOME_LOCK, TestRuxexHomeOverride};
    use ruxex_scheduler::ScheduleCadence;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri::Manager;

    fn home() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "ruxex-schedule-commands-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be available")
                .as_nanos()
        ))
    }

    fn input(name: &str) -> ScheduleInput {
        ScheduleInput {
            name: name.to_string(),
            prompt: "Review the latest changes".to_string(),
            icon: "calendar".to_string(),
            color: "blue".to_string(),
            thread_id: None,
            cadence: ScheduleCadence::Daily {
                hour: 9,
                minute: 30,
                time_zone: Some("UTC".to_string()),
            },
            enabled: true,
        }
    }

    #[tokio::test]
    async fn schedule_command_operations_cover_crud_and_error_mapping() {
        let home = home();
        std::fs::create_dir_all(&home).unwrap();
        let state = ScheduleState::default();

        assert!(schedule_list_at(&state, &home).await.unwrap().is_empty());
        let created = schedule_create_at(&state, &home, input("Morning review"))
            .await
            .unwrap();
        assert_eq!(created.name, "Morning review");

        let updated = schedule_update_at(&state, &home, &created.id, input("Daily review"))
            .await
            .unwrap();
        assert_eq!(updated.name, "Daily review");
        assert_eq!(
            schedule_set_enabled_at(&state, &home, &created.id, false)
                .await
                .unwrap()
                .enabled,
            false
        );
        assert_eq!(schedule_list_at(&state, &home).await.unwrap().len(), 1);
        schedule_delete_at(&state, &home, &created.id)
            .await
            .unwrap();
        assert!(schedule_list_at(&state, &home).await.unwrap().is_empty());

        let missing = schedule_update_at(&state, &home, "missing", input("Missing"))
            .await
            .unwrap_err();
        assert!(missing.message.contains("schedule not found"));
        assert!(
            schedule_set_enabled_at(&state, &home, "missing", true)
                .await
                .is_err()
        );
        assert!(schedule_delete_at(&state, &home, "missing").await.is_err());
        assert!(
            schedule_run_now_at(&state, &home, "missing", None)
                .await
                .is_err()
        );

        std::fs::remove_dir_all(home).unwrap();
    }

    #[tokio::test(flavor = "current_thread")]
    async fn tauri_schedule_commands_use_the_configured_home_and_dispatcher_fallback() {
        let _env_lock = TEST_RUXEX_HOME_LOCK.lock().unwrap();
        let home = home();
        std::fs::create_dir_all(&home).unwrap();
        let _home_override = TestRuxexHomeOverride::set(&home);
        let app = tauri::test::mock_builder()
            .manage(ScheduleState::default())
            .manage(AppServerState::default())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let state = app.state::<ScheduleState>();

        assert!(
            super::schedule_list(state.clone())
                .await
                .unwrap()
                .is_empty()
        );
        let created = super::schedule_create(state.clone(), input("Tauri schedule"))
            .await
            .unwrap();
        assert_eq!(created.name, "Tauri schedule");
        assert!(
            super::schedule_update(state.clone(), "missing".into(), input("Missing"))
                .await
                .is_err()
        );
        let updated = super::schedule_update(state.clone(), created.id.clone(), input("Updated"))
            .await
            .unwrap();
        assert_eq!(updated.name, "Updated");
        assert!(
            !super::schedule_set_enabled(state.clone(), created.id.clone(), false)
                .await
                .unwrap()
                .enabled
        );
        assert!(
            super::schedule_run_now(app.handle().clone(), state.clone(), "missing".into())
                .await
                .is_err()
        );
        super::schedule_delete(state.clone(), created.id.clone())
            .await
            .unwrap();
        assert!(super::schedule_list(state).await.unwrap().is_empty());
        super::run_due_schedules(app.handle()).await.unwrap();

        drop(app);
        drop(_home_override);
        std::fs::remove_dir_all(home).unwrap();
    }
}
