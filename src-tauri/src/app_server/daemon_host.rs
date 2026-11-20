use crate::desktop;
use crate::desktop_config::{DesktopConfig, DesktopRuntimeState};

pub fn run_host_app_server_daemon_with_config(config: DesktopConfig) -> anyhow::Result<()> {
    let runtime = DesktopRuntimeState::new(config.clone()).map_err(anyhow::Error::msg)?;
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
            ruxex::desktop::host::run_host_app_server_daemon_with_provider_factory_and_identity_and_system_prompt_profile(
                arg0_paths,
                Default::default(),
                Default::default(),
                false,
                provider_factory,
                product_identity,
                config.system_prompt_profile.clone(),
            )
            .await?;
        if exit == ruxex::desktop::AppServerExit::Forced {
            std::process::exit(0);
        }
        Ok(())
    })
}
