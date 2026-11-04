use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub(crate) const QUICK_PANEL_LABEL: &str = "quick-panel";
pub(crate) const QUICK_PANEL_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";
pub(crate) const QUICK_PANEL_ROUTE: &str = "index.html#/quick-panel";

pub(crate) fn panel_label() -> &'static str {
    QUICK_PANEL_LABEL
}

pub(crate) fn default_shortcut() -> &'static str {
    QUICK_PANEL_SHORTCUT
}

pub(crate) fn panel_route() -> &'static str {
    QUICK_PANEL_ROUTE
}

pub(crate) fn show<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(panel_label()) {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        panel_label(),
        WebviewUrl::App(panel_route().into()),
    )
    .title("Quick request")
    .inner_size(560.0, 360.0)
    .min_inner_size(420.0, 280.0)
    .resizable(true)
    .always_on_top(true)
    .decorations(true)
    .center()
    .build()?;

    Ok(())
}

#[tauri::command]
pub(crate) fn close_quick_panel<R: Runtime>(window: tauri::WebviewWindow<R>) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{default_shortcut, panel_label, panel_route};

    #[test]
    fn uses_a_stable_panel_identity() {
        assert_eq!(panel_label(), "quick-panel");
        assert_eq!(default_shortcut(), "CmdOrCtrl+Shift+Space");
        assert_eq!(panel_route(), "index.html#/quick-panel");
    }
}
