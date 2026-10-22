mod app_server;
mod desktop;
mod error;
#[cfg(feature = "example")]
mod example_provider;
mod platform;
mod schedule_commands;
mod scheduler;
mod worktree;
mod worktree_commands;

#[cfg(feature = "example")]
pub fn run_example_provider_host() -> anyhow::Result<()> {
    ruxex_arg0::arg0_dispatch_or_else(|arg0_paths| async move {
        example_provider::run(arg0_paths, desktop::product_identity()).await
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(app_server::AppServerState::default())
        .manage(schedule_commands::ScheduleState::default())
        .setup(|app| {
            let home = desktop::ruxex_home().map_err(std::io::Error::other)?;

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
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_server::ensure_app_server,
            app_server::connect_app_server,
            app_server::disconnect_app_server,
            app_server::app_server_connection_status,
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
