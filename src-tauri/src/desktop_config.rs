use std::fs;
use std::path::{Path, PathBuf};

#[cfg(not(feature = "example"))]
use ruxex::ModelProviderFactory;
use ruxex::ProductIdentity;
use ruxex::desktop::ProviderRuntimeFactory;

use crate::branding::Branding;

/// Runtime composition root for the Tauri template.
///
/// Consumers can replace the visible product identity, the provider runtime,
/// and the product-scoped home directory name without changing the template's
/// internal App Server wiring.
#[derive(Clone)]
pub struct DesktopConfig {
    pub branding: Branding,
    pub provider_factory: ProviderRuntimeFactory,
}

impl DesktopConfig {
    /// Create a runtime configuration from an application identity and
    /// provider-owned runtime factory.
    pub fn new(branding: Branding, provider_factory: ProviderRuntimeFactory) -> Self {
        Self {
            branding,
            provider_factory,
        }
    }

    /// Resolve the product identity used by clients, markers, and the daemon.
    pub fn product_identity(&self) -> ProductIdentity {
        ProductIdentity::new(
            &self.branding.window_title,
            &self.branding.product_slug,
            &self.branding.home_dir_name,
            &self.branding.home_marker_file,
        )
        .expect("desktop branding contains a valid product identity")
    }

    /// Resolve the configured data directory below the current user's home.
    pub fn resolve_home(&self) -> Result<PathBuf, String> {
        let user_home =
            dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
        Ok(self
            .product_identity()
            .resolve_home_from(user_home)
            .map_err(|error| format!("failed to resolve desktop home: {error}"))?
            .into_path_buf())
    }
}

pub(crate) struct DesktopRuntimeState {
    config: DesktopConfig,
    home: PathBuf,
}

impl DesktopRuntimeState {
    pub(crate) fn new(config: DesktopConfig) -> Result<Self, String> {
        let home = config.resolve_home()?;
        fs::create_dir_all(&home)
            .map_err(|error| format!("failed to create desktop home: {error}"))?;
        Ok(Self { config, home })
    }

    pub(crate) fn config(&self) -> &DesktopConfig {
        &self.config
    }

    pub(crate) fn home(&self) -> &Path {
        &self.home
    }
}

#[cfg(feature = "example")]
pub fn default_config() -> DesktopConfig {
    DesktopConfig::new(
        Branding::ruxex(),
        ruxex_provider_host_example::dummy_provider::provider_factory(),
    )
}

#[cfg(not(feature = "example"))]
pub fn default_config() -> DesktopConfig {
    DesktopConfig::new(
        Branding::ruxex(),
        (
            ruxex::desktop::client::AppServerRuntimeBuilder::build_from_provider_factory::<
                ruxex::desktop::providers::ResponsesModelProvider,
            >,
            ruxex::desktop::providers::ResponsesModelProvider::provider_descriptor(),
        ),
    )
}

#[cfg(test)]
mod tests {
    use super::default_config;

    #[test]
    fn default_home_is_resolved_from_the_injected_directory_name() {
        let config = default_config();
        let home = config
            .product_identity()
            .resolve_home_from("/home/test-user")
            .unwrap();

        assert_eq!(
            home.as_path(),
            std::path::Path::new("/home/test-user/.ruxex_desktop")
        );
    }

    #[test]
    fn custom_branding_changes_product_home_without_changing_the_resolver() {
        let mut config = default_config();
        config.branding.home_dir_name = ".acme_desktop".to_string();

        let home = config
            .product_identity()
            .resolve_home_from("/home/test-user")
            .unwrap();

        assert_eq!(
            home.as_path(),
            std::path::Path::new("/home/test-user/.acme_desktop")
        );
    }
}
