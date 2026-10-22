#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(feature = "example")]
    if std::env::args_os()
        .any(|arg| arg == ruxex_app_server_daemon::HOST_APP_SERVER_DAEMON_MODE_ARG)
    {
        if let Err(error) = ruxex_desktop_lib::run_example_provider_host() {
            eprintln!("example provider host failed: {error:#}");
            std::process::exit(1);
        }
        return;
    }

    ruxex_desktop_lib::run();
}
