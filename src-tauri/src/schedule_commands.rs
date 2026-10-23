use ruxex_scheduler::{AppServerDispatcher, ScheduleInput, ScheduleRecord};
use tauri::{AppHandle, Manager, State};

use crate::app_server::{AppServerState, request_handle};
use crate::desktop::ruxex_home;
use crate::error::{
    CommandResult, DesktopAppServerError, DesktopAppServerErrorKind, command_error,
};

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
    state.list(&home).await.map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_create(
    state: State<'_, ScheduleState>,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    state.create(&home, input).await.map_err(schedule_error)
}

#[tauri::command]
pub(crate) async fn schedule_update(
    state: State<'_, ScheduleState>,
    id: String,
    input: ScheduleInput,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    state
        .update(&home, &id, input)
        .await
        .map_err(schedule_error)
}

#[tauri::command]
pub(crate) async fn schedule_set_enabled(
    state: State<'_, ScheduleState>,
    id: String,
    enabled: bool,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    state
        .set_enabled(&home, &id, enabled)
        .await
        .map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_delete(
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<()> {
    let home = schedule_home()?;
    state.delete(&home, &id).await.map_err(schedule_file_error)
}

#[tauri::command]
pub(crate) async fn schedule_run_now(
    app: AppHandle,
    state: State<'_, ScheduleState>,
    id: String,
) -> CommandResult<ScheduleRecord> {
    let home = schedule_home()?;
    let app_server = app.state::<AppServerState>();
    let handle = request_handle(&app_server).await.ok();
    let dispatcher = handle.as_ref().map(AppServerDispatcher::new);
    state
        .run_now(&home, &id, dispatcher.as_ref())
        .await
        .map_err(schedule_error)
}

pub(crate) async fn run_due_schedules(app: &AppHandle) -> Result<(), String> {
    let home = ruxex_home()?;
    let state = app.state::<ScheduleState>();
    let app_server = app.state::<AppServerState>();
    let handle = request_handle(&app_server).await.ok();
    let dispatcher = handle.as_ref().map(AppServerDispatcher::new);
    state.run_due(&home, dispatcher.as_ref()).await
}
