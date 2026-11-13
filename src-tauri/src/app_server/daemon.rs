use super::*;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

use ruxex::desktop::daemon::{BackendKind, run_with_host_executable};

pub(super) async fn connect_unix_socket(
    socket_path: AbsolutePathBuf,
    config: &DesktopConfig,
) -> Result<RemoteAppServerClient, std::io::Error> {
    RemoteAppServerClient::connect(RemoteAppServerConnectArgs {
        endpoint: RemoteAppServerEndpoint::UnixSocket { socket_path },
        client_name: config.product_identity().product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: 128,
    })
    .await
}

pub(super) fn client_socket_candidates(data_home: &Path) -> Result<Vec<AbsolutePathBuf>, String> {
    let logical_socket_path = app_server_control_socket_path(data_home)
        .map_err(|error| format!("failed to resolve App Server control socket: {error}"))?;
    let mut socket_paths = vec![logical_socket_path];
    #[cfg(unix)]
    {
        let physical_socket_path =
            AbsolutePathBuf::from_absolute_path(client_physical_socket_path(data_home)?)
                .map_err(|error| error.to_string())?;
        if socket_paths[0] != physical_socket_path {
            socket_paths.push(physical_socket_path);
        }
    }
    Ok(socket_paths)
}

#[cfg(unix)]
pub(super) fn client_physical_socket_path(data_home: &Path) -> Result<PathBuf, String> {
    use sha2::Digest;
    use sha2::Sha256;
    use std::os::unix::ffi::OsStrExt;

    let logical_path = data_home
        .join("app-server-control")
        .join("app-server-control.sock");
    let parent = logical_path
        .parent()
        .ok_or_else(|| "App Server socket path has no parent".to_string())?;
    let canonical_parent = canonicalize_existing_prefix(parent)?;
    let canonical_path = canonical_parent.join(
        logical_path
            .file_name()
            .ok_or_else(|| "App Server socket path has no filename".to_string())?,
    );
    let hash = Sha256::digest(canonical_path.as_os_str().as_bytes());
    let temporary_root = std::fs::canonicalize("/tmp")
        .map_err(|error| format!("failed to resolve temporary directory: {error}"))?;
    let uid = unsafe { libc::geteuid() };
    Ok(temporary_root
        .join(format!("ruxex-daemon-{uid}"))
        .join(format!("{hash:x}")))
}

#[cfg(unix)]
pub(super) fn canonicalize_existing_prefix(path: &Path) -> Result<PathBuf, String> {
    let mut current = path.to_path_buf();
    let mut missing = Vec::<OsString>::new();
    while !current.exists() {
        let name = current
            .file_name()
            .ok_or_else(|| "App Server socket path has no existing ancestor".to_string())?;
        missing.push(name.to_os_string());
        current.pop();
    }

    let mut canonical = std::fs::canonicalize(&current)
        .map_err(|error| format!("failed to canonicalize App Server socket path: {error}"))?;
    for name in missing.iter().rev() {
        canonical.push(name);
    }
    Ok(canonical)
}

#[cfg(unix)]
pub(super) async fn client_socket_peer_pid(socket_path: &Path) -> Result<Option<u32>, String> {
    let stream = tokio::net::UnixStream::connect(socket_path)
        .await
        .map_err(|error| format!("failed to connect to App Server socket: {error}"))?;
    stream
        .peer_cred()
        .map_err(|error| format!("failed to inspect App Server socket owner: {error}"))?
        .pid()
        .map(|pid| {
            u32::try_from(pid).map_err(|_| "App Server socket owner PID is invalid".to_string())
        })
        .transpose()
}

pub(super) struct DaemonSocketProbe {
    socket_path: AbsolutePathBuf,
    app_server_version: Option<String>,
    peer_pid: Option<u32>,
}

pub(super) async fn probe_daemon_socket(
    socket_path: AbsolutePathBuf,
    config: &DesktopConfig,
) -> Option<DaemonSocketProbe> {
    let client = connect_unix_socket(socket_path.clone(), config)
        .await
        .ok()?;
    let app_server_version = client.server_version().map(str::to_owned);
    #[cfg(unix)]
    let peer_pid = client_socket_peer_pid(socket_path.as_path())
        .await
        .ok()
        .flatten();
    #[cfg(not(unix))]
    let peer_pid = None;
    let _ = client.shutdown().await;
    Some(DaemonSocketProbe {
        socket_path,
        app_server_version,
        peer_pid,
    })
}

pub(super) async fn probe_physical_residual_daemon(
    config: &DesktopConfig,
) -> CommandResult<Option<DaemonSocketProbe>> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_paths = client_socket_candidates(&home)
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let Some(physical_socket_path) = socket_paths.get(1).cloned() else {
        return Ok(None);
    };

    if probe_daemon_socket(socket_paths[0].clone(), config)
        .await
        .is_some()
    {
        return Ok(None);
    }
    Ok(probe_daemon_socket(physical_socket_path, config).await)
}

pub(super) fn desktop_app_server_daemon_args() -> [OsString; 2] {
    [
        OsString::from(HOST_APP_SERVER_DAEMON_MODE_ARG),
        OsString::from("--managed-daemon"),
    ]
}

pub(super) async fn run_desktop_app_server_lifecycle(
    command: LifecycleCommand,
) -> anyhow::Result<LifecycleOutput> {
    let executable = std::env::current_exe()?;
    run_with_host_executable(command, &executable, &desktop_app_server_daemon_args()).await
}

pub(super) async fn version_from_client(
    config: &DesktopConfig,
    lifecycle_error: anyhow::Error,
) -> CommandResult<LifecycleOutput> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_paths = client_socket_candidates(&home)
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;

    let mut probe_error = None;
    for socket_path in socket_paths {
        match probe_daemon_socket(socket_path.clone(), config).await {
            Some(probe) => {
                return Ok(LifecycleOutput {
                    status: LifecycleStatus::Running,
                    backend: Some(BackendKind::Pid),
                    pid: None,
                    managed_ruxex_path: PathBuf::new(),
                    managed_ruxex_version: None,
                    socket_path: probe.socket_path.as_path().to_path_buf(),
                    cli_version: None,
                    app_server_version: probe.app_server_version,
                });
            }
            None => {
                probe_error = Some(format!(
                    "failed to connect to {}",
                    socket_path.as_path().display()
                ))
            }
        }
    }

    Err(command_error(
        DesktopAppServerErrorKind::Lifecycle,
        format!(
            "AppServer daemon Version failed through the lifecycle client: {lifecycle_error:#}; physical socket probe failed: {}",
            probe_error
                .map(|error| error.to_string())
                .unwrap_or_else(|| "no socket candidate was available".to_string())
        ),
    ))
}

pub(super) fn recovered_daemon_output(
    status: LifecycleStatus,
    probe: &DaemonSocketProbe,
) -> LifecycleOutput {
    LifecycleOutput {
        status,
        backend: Some(BackendKind::Pid),
        pid: None,
        managed_ruxex_path: PathBuf::new(),
        managed_ruxex_version: None,
        socket_path: probe.socket_path.as_path().to_path_buf(),
        cli_version: None,
        app_server_version: probe.app_server_version.clone(),
    }
}

#[cfg(unix)]
pub(super) async fn recovered_daemon_socket_is_owned_by(
    probe: &DaemonSocketProbe,
    pid: u32,
) -> bool {
    client_socket_peer_pid(probe.socket_path.as_path())
        .await
        .ok()
        .flatten()
        == Some(pid)
}

#[cfg(unix)]
pub(super) async fn stop_recovered_daemon(probe: &DaemonSocketProbe) -> CommandResult<()> {
    let pid = probe.peer_pid.ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            "cannot stop residual App Server daemon: socket owner PID is unavailable",
        )
    })?;
    terminate_process(pid).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to gracefully stop residual App Server daemon: {error}"),
        )
    })?;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    while recovered_daemon_socket_is_owned_by(probe, pid).await {
        if tokio::time::Instant::now() >= deadline {
            force_terminate_process(pid).map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Lifecycle,
                    format!(
                        "residual App Server daemon did not stop gracefully; force stop failed: {error}"
                    ),
                )
            })?;
            let force_deadline = tokio::time::Instant::now() + Duration::from_secs(10);
            while recovered_daemon_socket_is_owned_by(probe, pid).await {
                if tokio::time::Instant::now() >= force_deadline {
                    return Err(command_error(
                        DesktopAppServerErrorKind::Lifecycle,
                        format!("timed out waiting for residual App Server daemon {pid} to stop"),
                    ));
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Ok(())
}

pub(super) async fn force_stop_app_server_daemon() -> CommandResult<LifecycleOutput> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    #[cfg(unix)]
    let physical_socket_path = client_physical_socket_path(&home).ok();
    #[cfg(unix)]
    let socket_owner_pid = match physical_socket_path.as_deref() {
        Some(path) => client_socket_peer_pid(path).await.ok().flatten(),
        None => None,
    };
    #[cfg(not(unix))]
    let socket_owner_pid = None;

    let pid = if let Some(pid) = socket_owner_pid {
        pid
    } else {
        let pid_file = [
            home.join("app-server-daemon/daemon.pid"),
            home.join("app-server.pid"),
        ]
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| {
            command_error(
                DesktopAppServerErrorKind::Lifecycle,
                "App Server daemon is not running (no live socket or PID file was found)",
            )
        })?;
        let pid_contents = tokio::fs::read_to_string(&pid_file)
            .await
            .map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Lifecycle,
                    format!("failed to read App Server daemon PID file: {error}"),
                )
            })?;
        let record: AppServerPidRecord = serde_json::from_str(&pid_contents).map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Lifecycle,
                format!("failed to decode App Server daemon PID file: {error}"),
            )
        })?;
        record.pid
    };

    force_terminate_process(pid).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to force terminate App Server daemon: {error}"),
        )
    })?;

    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve App Server socket path: {error}"),
        )
    })?;
    Ok(LifecycleOutput {
        status: LifecycleStatus::Stopped,
        backend: Some(BackendKind::Pid),
        pid: None,
        managed_ruxex_path: PathBuf::new(),
        managed_ruxex_version: None,
        socket_path: socket_path.as_path().to_path_buf(),
        cli_version: None,
        app_server_version: None,
    })
}

pub(super) fn force_terminate_process(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("PID must be greater than zero".to_string());
    }

    #[cfg(unix)]
    {
        let raw_pid = libc::pid_t::try_from(pid)
            .map_err(|_| format!("PID {pid} is out of range for this platform"))?;
        let result = unsafe { libc::kill(raw_pid, libc::SIGKILL) };
        if result == 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ESRCH) {
            return Ok(());
        }
        return Err(error.to_string());
    }

    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("taskkill exited with status {status}"))
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = pid;
        Err("force termination is unsupported on this platform".to_string())
    }
}

#[cfg(unix)]
pub(super) fn terminate_process(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("PID must be greater than zero".to_string());
    }

    let raw_pid = libc::pid_t::try_from(pid)
        .map_err(|_| format!("PID {pid} is out of range for this platform"))?;
    let result = unsafe { libc::kill(raw_pid, libc::SIGTERM) };
    if result == 0 {
        return Ok(());
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        Ok(())
    } else {
        Err(error.to_string())
    }
}
