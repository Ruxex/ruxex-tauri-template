use tauri::Manager;

mod app_server;
pub use app_server::run_host_app_server_daemon_with_config;
mod artifact_model;
mod artifact_pdf;
mod artifact_preview;
pub mod artifacts;
mod branding;
mod desktop;
mod desktop_config;
#[cfg(all(feature = "e2e", target_os = "linux"))]
mod e2e_screenshot;
mod editor;
mod error;
mod git_context;
mod git_diff;
mod git_diff_commands;
mod github;
mod github_issue_drafts;
mod github_links;
mod marketplace_assets;
mod ooxml;
mod platform;
mod quick_panel;
mod schedule_commands;
mod scheduler_app_server;
mod terminal;
mod visualization;
mod worktree;
mod worktree_commands;

pub use crate::branding::Branding;
pub use crate::desktop_config::{
    DesktopConfig, DesktopConfigBuilder, DesktopUiPolicy, SkillPolicy, default_config,
};

const SCHEDULE_POLL_INTERVAL_SECS: u64 = 60;

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
        .manage(github_links::GitHubLinkState::default())
        .manage(terminal::TerminalState::default())
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
            desktop_config::get_desktop_ui_policy,
            app_server::ensure_app_server,
            app_server::create_chat_workspace,
            app_server::app_server_daemon_control,
            artifact_preview::preview_artifact,
            artifact_preview::open_artifact,
            editor::detect_editor_command,
            editor::open_workspace_in_editor,
            artifact_preview::save_artifact,
            desktop::read_image_file,
            visualization::read_visualization_file,
            marketplace_assets::read_local_marketplace_asset,
            marketplace_assets::read_marketplace_asset,
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
            terminal::terminal_start,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::terminal_session_timeout_read,
            terminal::terminal_session_timeout_update,
            worktree_commands::worktree_list,
            worktree_commands::worktree_create,
            worktree_commands::worktree_remove,
            worktree_commands::worktree_open,
            git_diff_commands::git_diff_summary,
            git_diff_commands::git_diff_details,
            git_diff_commands::git_diff_file_patch,
            git_context::git_workspace_context,
            github::github_workspace_discover,
            github::github_issue_list,
            github::github_issue_read,
            github::github_issue_thread_start,
            github::github_pull_request_list,
            github::github_pull_request_read,
            github::github_pull_request_prepare,
            github::github_pull_request_create,
            github_issue_drafts::github_issue_drafts_validate,
            github_issue_drafts::github_issue_drafts_create,
            github_links::github_repository_bindings_list,
            github_links::github_repository_binding_save,
            github_links::github_object_thread_links_list,
            github_links::github_thread_links_list,
            github_links::github_object_thread_link_add,
            github_links::github_object_thread_link_remove,
            github_links::github_pull_request_issue_links_list,
            github_links::github_issue_pull_request_links_list,
            github_links::github_pull_request_issue_link_add,
            app_server::app_server_request,
            app_server::app_server_resolve_server_request,
            app_server::app_server_reject_server_request,
            #[cfg(all(feature = "e2e", target_os = "linux"))]
            e2e_screenshot::capture_ui_fixture_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running the desktop application");
}
