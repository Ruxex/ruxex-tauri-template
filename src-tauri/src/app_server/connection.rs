use super::*;

pub(super) async fn install_connection(
    app: &AppHandle,
    state: &State<'_, AppServerState>,
    mut client: AppServerClient,
    status: AppServerStatus,
) -> CommandResult<AppServerStatus> {
    let old_shutdown = state.shutdown.lock().await.take();
    if let Some(sender) = old_shutdown {
        let _ = sender.send(()).await;
    }

    let request_handle = client.request_handle();
    *state.request_handle.lock().await = Some(request_handle);
    *state.status.lock().await = Some(status.clone());

    let (shutdown_tx, mut shutdown_rx) = tauri::async_runtime::channel(1);
    *state.shutdown.lock().await = Some(shutdown_tx);
    let event_app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => break,
                event = client.next_event() => {
                    let Some(event) = event else { break };
                    let payload = match event {
                        AppServerEvent::Lagged { skipped } => DesktopAppServerEvent::Lagged { skipped },
                        AppServerEvent::ServerNotification(notification) => {
                            match serde_json::to_value(notification) {
                                Ok(notification) => DesktopAppServerEvent::ServerNotification(notification),
                                Err(error) => DesktopAppServerEvent::Disconnected {
                                    message: format!("failed to serialize server notification: {error}"),
                                },
                            }
                        }
                        AppServerEvent::ServerRequest(request) => match serde_json::to_value(request) {
                            Ok(request) => DesktopAppServerEvent::ServerRequest(request),
                            Err(error) => DesktopAppServerEvent::Disconnected {
                                message: format!("failed to serialize server request: {error}"),
                            },
                        },
                        AppServerEvent::Disconnected { message } => {
                            DesktopAppServerEvent::Disconnected { message }
                        }
                    };
                    log_app_server_io(AppServerLogDirection::FromAppServer, &payload);
                    if event_app.emit("app-server-event", payload).is_err() {
                        break;
                    }
                }
            }
        }
        let _ = client.shutdown().await;
    });

    Ok(status)
}

pub(super) async fn clear_connection_state(state: &AppServerState) {
    if let Some(sender) = state.shutdown.lock().await.take() {
        let _ = sender.send(()).await;
    }
    *state.request_handle.lock().await = None;
    *state.status.lock().await = None;
}

async fn connect_daemon_endpoint(
    config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let socket_path = app_server_control_socket_path(&home).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error.to_string())
    })?;
    #[cfg(unix)]
    let physical_socket_path = AbsolutePathBuf::from_absolute_path(
        client_physical_socket_path(&home)
            .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?,
    )
    .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error.to_string()))?;
    let (client, effective_socket_path, bootstrapped_version, connected_version) =
        match connect_unix_socket(socket_path.clone(), config).await {
            Ok(client) => {
                let connected_version = client.server_version().map(str::to_owned);
                (
                    AppServerClient::Remote(client),
                    socket_path,
                    None,
                    connected_version,
                )
            }
            Err(_) => {
                #[cfg(unix)]
                let physical_connection = if physical_socket_path.as_path() != socket_path.as_path()
                {
                    connect_unix_socket(physical_socket_path.clone(), config)
                        .await
                        .ok()
                } else {
                    None
                };
                #[cfg(not(unix))]
                let physical_connection: Option<RemoteAppServerClient> = None;
                if let Some(client) = physical_connection {
                    let connected_version = client.server_version().map(str::to_owned);
                    (
                        AppServerClient::Remote(client),
                        #[cfg(unix)]
                        physical_socket_path,
                        #[cfg(not(unix))]
                        socket_path,
                        None,
                        connected_version,
                    )
                } else {
                    let lifecycle = run_desktop_app_server_lifecycle(LifecycleCommand::Start)
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Lifecycle,
                                format!(
                                    "failed to start the {} provider app-server: {error:#}",
                                    config.provider_factory.1.provider_kind
                                ),
                            )
                        })?;
                    let effective_socket_path =
                        AbsolutePathBuf::from_absolute_path(lifecycle.socket_path.clone())
                            .map_err(|error| {
                                command_error(
                                    DesktopAppServerErrorKind::Initialization,
                                    error.to_string(),
                                )
                            })?;
                    let client = connect_unix_socket(effective_socket_path.clone(), config)
                        .await
                        .map_err(|error| {
                            command_error(
                                DesktopAppServerErrorKind::Initialization,
                                error.to_string(),
                            )
                        })?;
                    (
                        AppServerClient::Remote(client),
                        effective_socket_path,
                        lifecycle
                            .app_server_version
                            .or_else(|| Some("0.4.2".to_string())),
                        None,
                    )
                }
            }
        };
    let status = AppServerStatus {
        socket_path: effective_socket_path.display().to_string(),
        home_data_dir: home.display().to_string(),
        app_server_version: connected_version
            .or(bootstrapped_version)
            .unwrap_or_else(|| "unknown".to_string()),
        mode: Some(AppServerMode::Daemon),
    };
    Ok((client, status))
}

async fn connect_in_process_endpoint(
    arg0_paths: Arg0DispatchPaths,
    desktop_config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let (executable, runtime_paths) = resolve_in_process_paths(&arg0_paths)?;
    let loaded_config = Config::load_with_cli_overrides_and_harness_overrides(
        Vec::new(),
        ConfigOverrides {
            ruxex_self_exe: Some(executable.clone()),
            ..ConfigOverrides::default()
        },
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to load in-process App Server config: {error}"),
        )
    })?;

    let runtime = initialize_in_process_runtime(&loaded_config, desktop_config)
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to initialize the in-process provider: {error}"),
            )
        })?;
    let state_db = core::init_state_db(&loaded_config).await;
    let environment_manager = EnvironmentManager::from_ruxex_home(
        &loaded_config.ruxex_home,
        Some(runtime_paths),
        loaded_config.http_client_factory(),
    )
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to initialize in-process environment manager: {error}"),
        )
    })?;
    let config_warnings = loaded_config
        .startup_warnings
        .iter()
        .cloned()
        .map(|summary| ConfigWarningNotification {
            summary,
            details: None,
            path: None,
            range: None,
        })
        .collect();
    let product_identity = desktop_config.product_identity();
    let client = InProcessAppServerClient::start(InProcessClientStartArgs {
        arg0_paths,
        config: Arc::new(loaded_config),
        cli_overrides: Vec::new(),
        loader_overrides: LoaderOverrides::default(),
        strict_config: false,
        log_db: None,
        state_db,
        environment_manager: Arc::new(environment_manager),
        config_warnings,
        session_source: SessionSource::Cli,
        enable_api_key_env: true,
        runtime: Some(runtime),
        client_name: product_identity.product_name().to_string(),
        client_version: env!("CARGO_PKG_VERSION").to_string(),
        experimental_api: DESKTOP_EXPERIMENTAL_API,
        opt_out_notification_methods: Vec::new(),
        channel_capacity: DEFAULT_IN_PROCESS_CHANNEL_CAPACITY,
        product_identity,
    })
    .await
    .map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to start in-process App Server: {error}"),
        )
    })?;
    let client = AppServerClient::InProcess(client);
    let app_server_version = client
        .identity()
        .map(|identity| identity.version.clone())
        .unwrap_or_else(|| "unknown".to_string());
    let status = AppServerStatus {
        socket_path: "in-process".to_string(),
        home_data_dir: home.display().to_string(),
        app_server_version,
        mode: Some(AppServerMode::InProcess),
    };
    Ok((client, status))
}

async fn initialize_in_process_runtime(
    loaded_config: &Config,
    desktop_config: &DesktopConfig,
) -> anyhow::Result<ruxex::desktop::client::AppServerRuntime> {
    let provider_factory = &desktop_config.provider_factory;
    let provider_init = provider_init_from_config_with_descriptor(
        loaded_config,
        true,
        &provider_factory.1,
        desktop_config.product_identity().home_marker_file(),
    )
    .await?;
    Ok((provider_factory.0)(provider_init))
}

pub(super) async fn connect_local_endpoint(
    arg0_paths: Arg0DispatchPaths,
    config: &DesktopConfig,
) -> CommandResult<(AppServerClient, AppServerStatus)> {
    let (client, status) = match configured_app_server_mode()? {
        AppServerMode::Daemon => connect_daemon_endpoint(config).await,
        AppServerMode::InProcess => connect_in_process_endpoint(arg0_paths, config).await,
    }?;
    apply_desktop_skill_policy(&client, config)
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to apply desktop Skill policy: {error}"),
            )
        })?;
    Ok((client, status))
}
