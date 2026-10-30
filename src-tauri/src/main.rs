#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(feature = "example")]
    if std::env::args_os().any(|arg| arg == ruxex::desktop::daemon::HOST_APP_SERVER_DAEMON_MODE_ARG)
    {
        if let Err(error) = ruxex_desktop_lib::run_dummy_provider_host() {
            eprintln!("dummy provider host failed: {error:#}");
            std::process::exit(1);
        }
        return;
    }

    ruxex_desktop_lib::run();
}
