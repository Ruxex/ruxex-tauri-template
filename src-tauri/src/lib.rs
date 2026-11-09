use tauri::Manager;

mod app_server;
mod artifact_preview;
pub mod artifacts;
mod branding;
mod desktop;
mod desktop_config;
mod error;
mod platform;
mod quick_panel;
mod schedule_commands;
mod worktree;
mod worktree_commands;

pub use crate::branding::Branding;
pub use crate::desktop_config::{DesktopConfig, DesktopConfigBuilder, default_config};

const SCHEDULE_POLL_INTERVAL_SECS: u64 = 60;

#[cfg(test)]
mod tests {
    use super::SCHEDULE_POLL_INTERVAL_SECS;

    #[test]
    fn scheduler_poll_interval_is_one_minute() {
        assert_eq!(SCHEDULE_POLL_INTERVAL_SECS, 60);
    }
}

pub fn run_host_app_server_daemon_with_config(config: DesktopConfig) -> anyhow::Result<()> {
    let runtime =
        desktop_config::DesktopRuntimeState::new(config.clone()).map_err(anyhow::Error::msg)?;
    desktop::initialize_provider_home(
        runtime.home(),
        &config.product_identity(),
        &config.provider_factory.1,
    )
    .map_err(anyhow::Error::msg)?;
    unsafe {
        std::env::set_var("RUXEX_HOME", runtime.home());
        std::env::set_var("RUXEX_SQLITE_HOME", runtime.home());
    }

    ruxex::arg0::arg0_dispatch_or_else(|arg0_paths| async move {
        let provider_factory = config.provider_factory.clone();
        let product_identity = config.product_identity();
        let exit =
            ruxex::desktop::host::run_host_app_server_daemon_with_provider_factory_and_identity(
                arg0_paths,
                Default::default(),
                Default::default(),
                false,
                provider_factory,
                product_identity,
            )
            .await?;
        if exit == ruxex::desktop::AppServerExit::Forced {
            std::process::exit(0);
        }
        Ok(())
    })
}

pub fn run() {
    run_with_config(default_config());
}

pub fn run_with_config(config: DesktopConfig) {
    let runtime = desktop_config::DesktopRuntimeState::new(config.clone())
        .expect("desktop runtime configuration is valid");
    desktop::initialize_provider_home(
        runtime.home(),
        &config.product_identity(),
        &config.provider_factory.1,
    )
    .expect("desktop provider home is writable and compatible");
    unsafe {
        std::env::set_var("RUXEX_HOME", runtime.home());
        std::env::set_var("RUXEX_SQLITE_HOME", runtime.home());
    }

    let arg0_path_guard = ruxex::arg0::arg0_dispatch();
    let arg0_paths = arg0_path_guard
        .as_ref()
        .map(|guard| guard.paths().clone())
        .unwrap_or_default();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;

                    if event.state() == ShortcutState::Pressed {
                        if let Err(error) = quick_panel::show(app) {
                            eprintln!("failed to show quick panel: {error}");
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(feature = "e2e")]
    let builder = builder.plugin(tauri_plugin_wdio::init());

    builder
        .manage(app_server::AppServerState::with_arg0_paths(
            arg0_paths,
            arg0_path_guard,
            config,
        ))
        .manage(runtime)
        .manage(schedule_commands::ScheduleState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_title(
                        &app.state::<desktop_config::DesktopRuntimeState>()
                            .config()
                            .branding
                            .window_title,
                    )
                    .map_err(std::io::Error::other)?;
            }
            #[cfg(desktop)]
            {
                if let Err(error) = quick_panel::register_startup(app.handle()) {
                    eprintln!("failed to register quick panel shortcut: {error}");
                }
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
            branding::get_branding,
            app_server::ensure_app_server,
            app_server::app_server_daemon_control,
            artifact_preview::preview_artifact,
            desktop::read_image_file,
            desktop::read_local_marketplace_asset,
            desktop::read_marketplace_asset,
            desktop::open_browser_window,
            quick_panel::close_quick_panel,
            quick_panel::quick_panel_shortcut_read,
            quick_panel::quick_panel_shortcut_update,
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
        .expect("error while running the desktop application");
}
