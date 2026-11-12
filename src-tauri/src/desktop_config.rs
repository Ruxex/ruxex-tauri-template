use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::State;

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
    pub skill_policy: SkillPolicy,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SkillPolicy {
    disabled_skills: BTreeSet<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUiPolicy {
    pub hidden_skills: Vec<String>,
}

impl SkillPolicy {
    pub fn disable(mut self, name: impl Into<String>) -> Self {
        let name = name.into().trim().to_string();
        if !name.is_empty() {
            self.disabled_skills.insert(name);
        }
        self
    }

    pub fn ui_policy(&self) -> DesktopUiPolicy {
        DesktopUiPolicy {
            hidden_skills: self.disabled_skills.iter().cloned().collect(),
        }
    }
}

/// Builder for the Tauri template's runtime composition root.
pub struct DesktopConfigBuilder {
    branding: Branding,
    provider_factory: ProviderRuntimeFactory,
    skill_policy: SkillPolicy,
}

impl DesktopConfig {
    /// Start a configuration with Ruxex branding defaults.
    pub fn builder(provider_factory: ProviderRuntimeFactory) -> DesktopConfigBuilder {
        DesktopConfigBuilder {
            branding: Branding::ruxex(),
            provider_factory,
            skill_policy: SkillPolicy::default(),
        }
    }

    /// Create a runtime configuration from an application identity and
    /// provider-owned runtime factory.
    #[deprecated(note = "use DesktopConfig::builder(provider_factory).branding(...).build()")]
    pub fn new(branding: Branding, provider_factory: ProviderRuntimeFactory) -> Self {
        Self::builder(provider_factory).branding(branding).build()
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

impl DesktopConfigBuilder {
    /// Replace the complete branding value.
    pub fn branding(mut self, branding: Branding) -> Self {
        self.branding = branding;
        self
    }

    /// Set the product's visible application name.
    pub fn app_name(mut self, value: impl Into<String>) -> Self {
        self.branding.app_name = value.into();
        self
    }

    /// Set the assistant name shown in the UI.
    pub fn assistant_name(mut self, value: impl Into<String>) -> Self {
        self.branding.assistant_name = value.into();
        self
    }

    /// Set the native window title.
    pub fn window_title(mut self, value: impl Into<String>) -> Self {
        self.branding.window_title = value.into();
        self
    }

    /// Set the stable product slug used by the App Server identity.
    pub fn product_slug(mut self, value: impl Into<String>) -> Self {
        self.branding.product_slug = value.into();
        self
    }

    /// Set the single directory name used below the current user's home.
    pub fn home_dir_name(mut self, value: impl Into<String>) -> Self {
        self.branding.home_dir_name = value.into();
        self
    }

    /// Set the provider marker filename stored in the product home.
    pub fn home_marker_file(mut self, value: impl Into<String>) -> Self {
        self.branding.home_marker_file = value.into();
        self
    }

    /// Disable and hide a Skill owned by the product composition root.
    pub fn disable_skill(mut self, name: impl Into<String>) -> Self {
        self.skill_policy = self.skill_policy.disable(name);
        self
    }

    /// Finish building the runtime configuration.
    pub fn build(self) -> DesktopConfig {
        DesktopConfig {
            branding: self.branding,
            provider_factory: self.provider_factory,
            skill_policy: self.skill_policy,
        }
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

#[tauri::command]
pub(crate) fn get_desktop_ui_policy(state: State<'_, DesktopRuntimeState>) -> DesktopUiPolicy {
    state.config().skill_policy.ui_policy()
}

#[cfg(feature = "example")]
pub fn default_config() -> DesktopConfig {
    let provider = std::env::var("RUXEX_PROVIDER").ok();
    example_provider_config(provider.as_deref())
}

#[cfg(feature = "example")]
fn example_provider_factory(selector: Option<&str>) -> Result<ProviderRuntimeFactory, String> {
    match selector {
        None => Ok(ruxex_provider_host_example::dummy_provider::provider_factory()),
        Some("cloudflare") => Ok(ruxex_provider_host_example::cloudflare::provider_factory()),
        Some(selector) => Err(format!(
            "unsupported RUXEX_PROVIDER value `{selector}`; expected `cloudflare`"
        )),
    }
}

#[cfg(feature = "example")]
pub(crate) fn example_provider_config(selector: Option<&str>) -> DesktopConfig {
    let builder = DesktopConfig::builder(
        example_provider_factory(selector)
            .unwrap_or_else(|error| panic!("invalid example provider selection: {error}")),
    )
    .disable_skill("imagegen");
    if selector == Some("cloudflare") {
        builder
            .home_dir_name(".ruxex_desktop_cloudflare")
            .home_marker_file("cloudflare-home.json")
            .build()
    } else {
        builder.build()
    }
}

#[cfg(not(feature = "example"))]
pub fn default_config() -> DesktopConfig {
    DesktopConfig::builder((
        ruxex::desktop::client::AppServerRuntimeBuilder::build_from_provider_factory::<
            ruxex::desktop::providers::ResponsesModelProvider,
        >,
        ruxex::desktop::providers::ResponsesModelProvider::provider_descriptor(),
    ))
    .build()
}

#[cfg(test)]
mod tests {
    use super::{DesktopConfig, SkillPolicy};
    use serde_json::json;

    #[cfg(not(feature = "example"))]
    use super::default_config;

    fn test_default_config() -> DesktopConfig {
        #[cfg(feature = "example")]
        {
            return super::example_provider_config(None);
        }

        #[cfg(not(feature = "example"))]
        {
            default_config()
        }
    }

    #[cfg(feature = "example")]
    #[test]
    fn example_provider_defaults_to_dummy() {
        let (_, descriptor) = super::example_provider_factory(None)
            .expect("missing provider selection should use the dummy provider");

        assert_eq!(descriptor.provider_kind, "dummy");
    }

    #[cfg(feature = "example")]
    #[test]
    fn example_providers_disable_image_generation_by_default() {
        for selector in [None, Some("cloudflare")] {
            let config = super::example_provider_config(selector);
            assert_eq!(
                config.skill_policy.ui_policy().hidden_skills,
                vec!["imagegen".to_string()]
            );
        }
    }

    #[cfg(feature = "example")]
    #[test]
    fn example_provider_can_select_cloudflare() {
        let (_, descriptor) = super::example_provider_factory(Some("cloudflare"))
            .expect("cloudflare provider selection should be accepted");

        assert_eq!(descriptor.provider_kind, "cloudflare");
    }

    #[cfg(feature = "example")]
    #[test]
    fn cloudflare_example_provider_uses_a_separate_home() {
        let config = super::example_provider_config(Some("cloudflare"));

        assert_eq!(config.branding.home_dir_name, ".ruxex_desktop_cloudflare");
        assert_eq!(config.branding.home_marker_file, "cloudflare-home.json");
    }

    #[cfg(feature = "example")]
    #[test]
    fn unknown_example_provider_is_rejected() {
        let error = super::example_provider_factory(Some("unknown"))
            .expect_err("unknown provider selections must be rejected");

        assert_eq!(
            error,
            "unsupported RUXEX_PROVIDER value `unknown`; expected `cloudflare`"
        );
    }

    #[test]
    fn default_home_is_resolved_from_the_injected_directory_name() {
        let config = test_default_config();
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
    fn skill_policy_deduplicates_disabled_names_and_exposes_ui_projection() {
        let policy = SkillPolicy::default()
            .disable("imagegen")
            .disable("imagegen")
            .disable("review");

        assert_eq!(
            policy.ui_policy(),
            super::DesktopUiPolicy {
                hidden_skills: vec!["imagegen".to_string(), "review".to_string()],
            }
        );
        assert_eq!(
            serde_json::to_value(policy.ui_policy()).unwrap(),
            json!({"hiddenSkills": ["imagegen", "review"]})
        );
    }

    #[test]
    fn builder_injects_disabled_skill_policy() {
        let config = DesktopConfig::builder(test_default_config().provider_factory.clone())
            .disable_skill("imagegen")
            .build();

        assert_eq!(
            config.skill_policy.ui_policy().hidden_skills,
            vec!["imagegen".to_string()]
        );
    }

    #[test]
    fn builder_changes_branding_and_product_home_without_changing_the_resolver() {
        let defaults = test_default_config();
        let config = DesktopConfig::builder(defaults.provider_factory.clone())
            .app_name("Acme")
            .assistant_name("Acme Assistant")
            .window_title("Acme Desktop")
            .product_slug("acme-desktop")
            .home_dir_name(".acme_desktop")
            .home_marker_file("acme-home.json")
            .build();

        let home = config
            .product_identity()
            .resolve_home_from("/home/test-user")
            .unwrap();

        assert_eq!(
            home.as_path(),
            std::path::Path::new("/home/test-user/.acme_desktop")
        );
        assert_eq!(config.branding.app_name, "Acme");
        assert_eq!(config.branding.assistant_name, "Acme Assistant");
        assert_eq!(config.branding.home_marker_file, "acme-home.json");
    }
}
