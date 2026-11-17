use std::fs::File;
use std::path::Path;

use tauri::{AppHandle, Manager};
use webkit2gtk::{SnapshotOptions, SnapshotRegion, WebViewExt};

#[tauri::command]
pub async fn capture_ui_fixture_screenshot(app: AppHandle, name: String) -> Result<(), String> {
    if Path::new(&name).file_name().and_then(|file| file.to_str()) != Some(&name)
        || !name.ends_with(".png")
    {
        return Err("Screenshot name must be a PNG filename".to_string());
    }

    let artifact_directory = std::env::var_os("RUXEX_E2E_ARTIFACTS")
        .map(std::path::PathBuf::from)
        .ok_or_else(|| "E2E screenshot directory is not configured".to_string())?;
    std::fs::create_dir_all(&artifact_directory).map_err(|error| error.to_string())?;
    let screenshot_path = artifact_directory.join(name);
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main webview window is unavailable".to_string())?;

    window
        .with_webview(move |platform_webview| {
            platform_webview.inner().snapshot(
                SnapshotRegion::Visible,
                SnapshotOptions::NONE,
                None::<&webkit2gtk::gio::Cancellable>,
                move |snapshot| {
                    let result = snapshot
                        .map_err(|error| error.to_string())
                        .and_then(|surface| {
                            let mut file =
                                File::create(screenshot_path).map_err(|error| error.to_string())?;
                            surface
                                .write_to_png(&mut file)
                                .map_err(|error| error.to_string())
                        });
                    let _ = sender.send(result);
                },
            );
        })
        .map_err(|error| error.to_string())?;

    receiver
        .await
        .map_err(|_| "WebKit screenshot capture was cancelled".to_string())?
}
