use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
    pub app_name: String,
    pub assistant_name: String,
    pub window_title: String,
    #[serde(skip_serializing)]
    pub product_slug: String,
    #[serde(skip_serializing)]
    pub home_dir_name: String,
    #[serde(skip_serializing)]
    pub home_marker_file: String,
}

impl Branding {
    pub fn new(
        app_name: impl Into<String>,
        assistant_name: impl Into<String>,
        window_title: impl Into<String>,
        product_slug: impl Into<String>,
        home_dir_name: impl Into<String>,
        home_marker_file: impl Into<String>,
    ) -> Self {
        Self {
            app_name: app_name.into(),
            assistant_name: assistant_name.into(),
            window_title: window_title.into(),
            product_slug: product_slug.into(),
            home_dir_name: home_dir_name.into(),
            home_marker_file: home_marker_file.into(),
        }
    }

    pub fn ruxex() -> Self {
        Self::new(
            "Ruxex",
            "Ruxex",
            "Ruxex Desktop",
            "ruxex-desktop",
            ".ruxex_desktop",
            "ruxex-home.json",
        )
    }
}

#[tauri::command]
pub(crate) fn get_branding(
    state: State<'_, crate::desktop_config::DesktopRuntimeState>,
) -> Branding {
    state.config().branding.clone()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::Branding;

    #[test]
    fn canonical_branding_contains_the_template_identity() {
        let branding = Branding::ruxex();
        assert_eq!(branding.app_name, "Ruxex");
        assert_eq!(branding.assistant_name, "Ruxex");
        assert_eq!(branding.window_title, "Ruxex Desktop");
        assert_eq!(branding.product_slug, "ruxex-desktop");
        assert_eq!(branding.home_dir_name, ".ruxex_desktop");
        assert_eq!(branding.home_marker_file, "ruxex-home.json");
    }

    #[test]
    fn branding_serializes_only_ui_fields() {
        let value = serde_json::to_value(Branding::ruxex()).unwrap();

        assert_eq!(
            value,
            json!({
                "appName": "Ruxex",
                "assistantName": "Ruxex",
                "windowTitle": "Ruxex Desktop",
            })
        );
    }

    #[test]
    fn branding_can_be_injected_from_outside_the_template() {
        let branding = Branding::new(
            "Acme",
            "Acme Assistant",
            "Acme Desktop",
            "acme-desktop",
            ".acme_desktop",
            "acme-home.json",
        );

        assert_eq!(branding.home_dir_name, ".acme_desktop");
        assert_eq!(branding.assistant_name, "Acme Assistant");
    }
}
