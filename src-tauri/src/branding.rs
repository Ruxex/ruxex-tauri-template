use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Branding {
    pub(crate) app_name: &'static str,
    pub(crate) assistant_name: &'static str,
    pub(crate) window_title: &'static str,
    #[serde(skip_serializing)]
    pub(crate) product_slug: &'static str,
    #[serde(skip_serializing)]
    pub(crate) home_dir_name: &'static str,
    #[serde(skip_serializing)]
    pub(crate) home_marker_file: &'static str,
}

pub(crate) const BRANDING: Branding = Branding {
    app_name: "Ruxex",
    assistant_name: "Ruxex",
    window_title: "Ruxex Desktop",
    product_slug: "ruxex-desktop",
    home_dir_name: ".ruxex_desktop",
    home_marker_file: "ruxex-home.json",
};

#[tauri::command]
pub(crate) fn get_branding() -> Branding {
    BRANDING
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{BRANDING, Branding, get_branding};

    #[test]
    fn canonical_branding_contains_the_template_identity() {
        assert_eq!(BRANDING.app_name, "Ruxex");
        assert_eq!(BRANDING.assistant_name, "Ruxex");
        assert_eq!(BRANDING.window_title, "Ruxex Desktop");
        assert_eq!(BRANDING.product_slug, "ruxex-desktop");
        assert_eq!(BRANDING.home_dir_name, ".ruxex_desktop");
        assert_eq!(BRANDING.home_marker_file, "ruxex-home.json");
    }

    #[test]
    fn branding_command_exposes_only_ui_fields() {
        let value = serde_json::to_value(get_branding()).unwrap();

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
    fn branding_is_copyable_for_tauri_state_free_access() {
        let copy: Branding = BRANDING;

        assert_eq!(copy.window_title, BRANDING.window_title);
    }
}
