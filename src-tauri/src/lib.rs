mod app_server;
mod desktop;
mod error;
#[cfg(feature = "example")]
use ruxex_provider_host_example::dummy_provider;
mod platform;
mod schedule_commands;
mod worktree;
mod worktree_commands;

const SCHEDULE_POLL_INTERVAL_SECS: u64 = 60;

#[cfg(test)]
mod tests {
    use super::SCHEDULE_POLL_INTERVAL_SECS;

    #[test]
    fn scheduler_poll_interval_is_one_minute() {
        assert_eq!(SCHEDULE_POLL_INTERVAL_SECS, 60);
    }
}

#[cfg(feature = "example")]
pub fn run_dummy_provider_host() -> anyhow::Result<()> {
    ruxex_arg0::arg0_dispatch_or_else(|arg0_paths| async move {
        let exit = ruxex::cli::run_host_app_server_daemon_with_provider_factory_and_identity(
            arg0_paths,
            Default::default(),
            Default::default(),
            false,
            dummy_provider::provider_factory(),
            desktop::product_identity(),
        )
        .await?;
        if exit == ruxex::app_server::AppServerExit::Forced {
            std::process::exit(0);
        }
        Ok(())
    })
}

pub fn run() {
    let arg0_path_guard = ruxex_arg0::arg0_dispatch();
    let arg0_paths = arg0_path_guard
        .as_ref()
        .map(|guard| guard.paths().clone())
        .unwrap_or_default();
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(app_server::AppServerState::with_arg0_paths(
            arg0_paths,
            arg0_path_guard,
        ))
        .manage(schedule_commands::ScheduleState::default())
        .setup(|app| {
            let home = desktop::ruxex_home().map_err(std::io::Error::other)?;

            #[cfg(feature = "example")]
            desktop::initialize_provider_home(&home).map_err(std::io::Error::other)?;

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
                    let _ = schedule_commands::run_due_schedules(&app_handle).await;
                    tokio::time::sleep(std::time::Duration::from_secs(SCHEDULE_POLL_INTERVAL_SECS))
                        .await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_server::ensure_app_server,
            app_server::app_server_daemon_control,
            desktop::read_image_file,
            desktop::open_browser_window,
            schedule_commands::schedule_list,
            schedule_commands::schedule_create,
            schedule_commands::schedule_update,
            schedule_commands::schedule_set_enabled,
            schedule_commands::schedule_delete,
            schedule_commands::schedule_run_now,
            worktree_commands::worktree_list,
            worktree_commands::worktree_create,
            worktree_commands::worktree_remove,
            worktree_commands::worktree_open,
            app_server::app_server_request,
            app_server::app_server_resolve_server_request,
            app_server::app_server_reject_server_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ruxex Desktop");
}
