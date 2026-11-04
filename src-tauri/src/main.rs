#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args_os().any(|arg| arg == ruxex::desktop::daemon::HOST_APP_SERVER_DAEMON_MODE_ARG)
    {
        if let Err(error) = ruxex_desktop_lib::run_host_app_server_daemon_with_config(
            ruxex_desktop_lib::default_config(),
        ) {
            eprintln!("provider host failed: {error:#}");
            std::process::exit(1);
        }
        return;
    }

    ruxex_desktop_lib::run();
}
