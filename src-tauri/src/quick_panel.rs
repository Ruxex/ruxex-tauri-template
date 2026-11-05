use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

pub(crate) const QUICK_PANEL_LABEL: &str = "quick-panel";
pub(crate) const QUICK_PANEL_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";
pub(crate) const QUICK_PANEL_ROUTE: &str = "index.html#/quick-panel";
const QUICK_PANEL_PREFERENCES_FILE: &str = "quick-panel.json";

#[derive(Debug, Deserialize, Serialize)]
struct QuickPanelPreferences {
    shortcut: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickPanelShortcut {
    pub(crate) shortcut: String,
    pub(crate) default_shortcut: &'static str,
}

pub(crate) fn panel_label() -> &'static str {
    QUICK_PANEL_LABEL
}

pub(crate) fn default_shortcut() -> &'static str {
    QUICK_PANEL_SHORTCUT
}

pub(crate) fn panel_route() -> &'static str {
    QUICK_PANEL_ROUTE
}

fn normalize_shortcut(value: &str) -> Option<String> {
    let shortcut = value.trim();
    (!shortcut.is_empty()
        && shortcut
            .parse::<tauri_plugin_global_shortcut::Shortcut>()
            .is_ok())
    .then(|| shortcut.to_owned())
}

pub(crate) fn read_persisted_shortcut(path: &Path) -> String {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<QuickPanelPreferences>(&contents).ok())
        .and_then(|preferences| normalize_shortcut(&preferences.shortcut))
        .unwrap_or_else(|| default_shortcut().to_owned())
}

fn write_persisted_shortcut(path: &Path, shortcut: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "quick panel preference path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create quick panel preference directory `{}`: {error}",
            parent.display()
        )
    })?;
    let temporary_path = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(&QuickPanelPreferences {
        shortcut: shortcut.to_owned(),
    })
    .map_err(|error| format!("failed to serialize quick panel preference: {error}"))?;
    fs::write(&temporary_path, contents).map_err(|error| {
        format!(
            "failed to write quick panel preference `{}`: {error}",
            temporary_path.display()
        )
    })?;
    replace_preference_file(&temporary_path, path)
}

fn replace_preference_file(temporary_path: &Path, path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path).map_err(|error| {
            format!(
                "failed to replace quick panel preference `{}`: {error}",
                path.display()
            )
        })?;
    }

    fs::rename(temporary_path, path).map_err(|error| {
        let _ = fs::remove_file(temporary_path);
        format!(
            "failed to commit quick panel preference `{}`: {error}",
            path.display()
        )
    })
}

pub(crate) fn update_persisted_shortcut<Unregister, Register, Persist>(
    current: &str,
    requested: &str,
    mut unregister: Unregister,
    mut register: Register,
    mut persist: Persist,
) -> Result<String, String>
where
    Unregister: FnMut(&str) -> Result<(), String>,
    Register: FnMut(&str) -> Result<(), String>,
    Persist: FnMut(&str) -> Result<(), String>,
{
    let requested = normalize_shortcut(requested)
        .ok_or_else(|| "Quick panel shortcut cannot be empty.".to_string())?;
    if requested == current {
        return Ok(requested);
    }

    unregister(current)?;
    if let Err(error) = register(&requested) {
        let _ = register(current);
        return Err(error);
    }
    if let Err(error) = persist(&requested) {
        let _ = unregister(&requested);
        let _ = register(current);
        return Err(error);
    }
    Ok(requested)
}

fn preference_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(QUICK_PANEL_PREFERENCES_FILE))
        .map_err(|error| format!("failed to resolve quick panel preferences: {error}"))
}

pub(crate) fn register_startup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let path = preference_path(app).map_err(std::io::Error::other)?;
    let shortcut = read_persisted_shortcut(&path);
    app.global_shortcut()
        .register(shortcut.as_str())
        .map_err(std::io::Error::other)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn quick_panel_shortcut_read<R: Runtime>(
    app: AppHandle<R>,
) -> Result<QuickPanelShortcut, String> {
    let path = preference_path(&app)?;
    Ok(QuickPanelShortcut {
        shortcut: read_persisted_shortcut(&path),
        default_shortcut: default_shortcut(),
    })
}

#[tauri::command]
pub(crate) fn quick_panel_shortcut_update<R: Runtime>(
    app: AppHandle<R>,
    shortcut: String,
) -> Result<QuickPanelShortcut, String> {
    let path = preference_path(&app)?;
    let current = read_persisted_shortcut(&path);
    update_persisted_shortcut(
        &current,
        &shortcut,
        |value| {
            app.global_shortcut()
                .unregister(value)
                .map_err(|error| error.to_string())
        },
        |value| {
            app.global_shortcut()
                .register(value)
                .map_err(|error| error.to_string())
        },
        |value| write_persisted_shortcut(&path, value),
    )?;
    quick_panel_shortcut_read(app)
}

pub(crate) fn show<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(panel_label()) {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, panel_label(), WebviewUrl::App(panel_route().into()))
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
    use std::cell::RefCell;
    use std::fs;
    use std::rc::Rc;

    use super::{
        default_shortcut, panel_label, panel_route, read_persisted_shortcut,
        update_persisted_shortcut,
    };

    fn temporary_preferences_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "ruxex-quick-panel-{name}-{}-{}.json",
            std::process::id(),
            name.len()
        ))
    }

    #[test]
    fn uses_a_stable_panel_identity() {
        assert_eq!(panel_label(), "quick-panel");
        assert_eq!(default_shortcut(), "CmdOrCtrl+Shift+Space");
        assert_eq!(panel_route(), "index.html#/quick-panel");
    }

    #[test]
    fn missing_or_invalid_preferences_fall_back_to_the_default_shortcut() {
        let path = temporary_preferences_path("fallback");
        let _ = fs::remove_file(&path);

        assert_eq!(read_persisted_shortcut(&path), default_shortcut());

        fs::write(&path, "{\"shortcut\":\"\"}").unwrap();
        assert_eq!(read_persisted_shortcut(&path), default_shortcut());

        fs::write(&path, "not-json").unwrap();
        assert_eq!(read_persisted_shortcut(&path), default_shortcut());

        fs::write(&path, "{\"shortcut\":\"Ctrl+NotAKey\"}").unwrap();
        assert_eq!(read_persisted_shortcut(&path), default_shortcut());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn successful_shortcut_update_persists_after_registration() {
        let path = temporary_preferences_path("success");
        let _ = fs::remove_file(&path);
        let registrations = Rc::new(RefCell::new(Vec::new()));
        let registration_log = Rc::clone(&registrations);

        let result = update_persisted_shortcut(
            default_shortcut(),
            "CmdOrCtrl+Alt+R",
            |_| Ok(()),
            move |shortcut| {
                registration_log.borrow_mut().push(shortcut.to_owned());
                Ok(())
            },
            |shortcut| {
                fs::write(&path, format!("{{\"shortcut\":\"{shortcut}\"}}"))
                    .map_err(|error| error.to_string())
            },
        );

        assert_eq!(result.unwrap(), "CmdOrCtrl+Alt+R");
        assert_eq!(read_persisted_shortcut(&path), "CmdOrCtrl+Alt+R");
        assert_eq!(registrations.borrow().as_slice(), &["CmdOrCtrl+Alt+R"]);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn failed_registration_restores_the_old_shortcut_and_does_not_persist() {
        let path = temporary_preferences_path("rollback");
        let _ = fs::remove_file(&path);
        fs::write(
            &path,
            format!("{{\"shortcut\":\"{}\"}}", default_shortcut()),
        )
        .unwrap();
        let registrations = Rc::new(RefCell::new(Vec::new()));
        let registration_log = Rc::clone(&registrations);

        let result = update_persisted_shortcut(
            default_shortcut(),
            "CmdOrCtrl+Alt+R",
            |_| Ok(()),
            move |shortcut| {
                registration_log.borrow_mut().push(shortcut.to_owned());
                if shortcut == "CmdOrCtrl+Alt+R" {
                    Err("shortcut is already in use".to_string())
                } else {
                    Ok(())
                }
            },
            |shortcut| {
                fs::write(&path, format!("{{\"shortcut\":\"{shortcut}\"}}"))
                    .map_err(|error| error.to_string())
            },
        );

        assert_eq!(result.unwrap_err(), "shortcut is already in use");
        assert_eq!(read_persisted_shortcut(&path), default_shortcut());
        assert_eq!(
            registrations.borrow().as_slice(),
            &["CmdOrCtrl+Alt+R", "CmdOrCtrl+Shift+Space"]
        );
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn empty_shortcut_is_rejected_without_touching_registration() {
        let result = update_persisted_shortcut(
            default_shortcut(),
            "  ",
            |_| panic!("unregister should not run"),
            |_| panic!("register should not run"),
            |_| panic!("persist should not run"),
        );

        assert_eq!(result.unwrap_err(), "Quick panel shortcut cannot be empty.");
    }

    #[test]
    fn replaces_an_existing_preference_file() {
        let directory =
            std::env::temp_dir().join(format!("ruxex-quick-panel-replace-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let temporary_path = directory.join("quick-panel.json.tmp");
        let target_path = directory.join("quick-panel.json");
        fs::write(&temporary_path, "new").unwrap();
        fs::write(&target_path, "old").unwrap();

        super::replace_preference_file(&temporary_path, &target_path).unwrap();

        assert_eq!(fs::read_to_string(&target_path).unwrap(), "new");
        fs::remove_dir_all(directory).unwrap();
    }
}
