use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use ruxex::ProductIdentity;

use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

pub(crate) fn product_identity() -> ProductIdentity {
    ProductIdentity::new(
        "Ruxex Desktop",
        "ruxex-desktop",
        ".ruxex_desktop",
        "ruxex-home.json",
    )
    .expect("desktop product identity is static and valid")
}

fn ruxex_home_from_user_home(user_home: &Path) -> PathBuf {
    product_identity()
        .resolve_home_from(user_home)
        .expect("desktop user home should be absolute")
        .into_path_buf()
}

pub(crate) fn ruxex_home() -> Result<PathBuf, String> {
    let user_home =
        dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
    let home = ruxex_home_from_user_home(&user_home);
    fs::create_dir_all(&home)
        .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
    Ok(home)
}

#[tauri::command]
pub(crate) fn read_image_file(path: String) -> CommandResult<String> {
    let requested = PathBuf::from(&path);
    if !requested.is_absolute() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path must be absolute",
        ));
    }
    let canonical = requested.canonicalize().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("image path cannot be opened: {error}"),
        )
    })?;
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    let roots = [home, workspace];
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots
        .iter()
        .map(PathBuf::as_path)
        .collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path is outside the Ruxex or workspace roots",
        ));
    }
    let mime = platform::image_mime_type(&canonical).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "only png, jpeg, gif, and webp images are supported",
        )
    })?;
    let bytes = fs::read(&canonical).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read image: {error}"),
        )
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image exceeds the 16 MiB presentation limit",
        ));
    }
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub(crate) fn open_browser_window(url: String) -> CommandResult<()> {
    let url = platform::validate_browser_url(&url).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "browser URL must use http:// or https://",
        )
    })?;
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to open browser URL: {error}"),
        )
    })
}

#[cfg(not(feature = "example"))]
pub(crate) fn runtime_package_source(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;

    let resource_package = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve application resources: {error}"))?
        .join("ruxex-package");
    let development_package = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("ruxex-package");
    select_runtime_package(&resource_package, &development_package)
}

#[cfg(any(not(feature = "example"), test))]
fn select_runtime_package(
    resource_package: &Path,
    development_package: &Path,
) -> Result<PathBuf, String> {
    if resource_package.join("ruxex-package.json").is_file() {
        return Ok(resource_package.to_path_buf());
    }
    if development_package.join("ruxex-package.json").is_file() {
        return Ok(development_package.to_path_buf());
    }
    Err(format!(
        "bundled Ruxex runtime package not found at {} or {}",
        resource_package.display(),
        development_package.display()
    ))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::{product_identity, ruxex_home_from_user_home, select_runtime_package};

    #[test]
    fn desktop_home_is_isolated_under_user_home() {
        assert_eq!(
            ruxex_home_from_user_home(Path::new("/home/user")),
            Path::new("/home/user/.ruxex_desktop"),
        );
    }

    #[test]
    fn desktop_product_identity_is_separate_from_tui_branding() {
        let identity = product_identity();

        assert_eq!(identity.product_name(), "Ruxex Desktop");
        assert_eq!(identity.product_slug(), "ruxex-desktop");
        assert_eq!(identity.home_dir_name(), ".ruxex_desktop");
    }

    fn package_fixture(name: &str, with_manifest: bool) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("ruxex-desktop-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        if with_manifest {
            fs::write(path.join("ruxex-package.json"), "{}\n").unwrap();
        }
        path
    }

    #[test]
    fn runtime_package_selection_prefers_bundled_resources() {
        let resource = package_fixture("resource", true);
        let development = package_fixture("development", true);

        assert_eq!(
            select_runtime_package(&resource, &development).unwrap(),
            resource
        );

        let _ = fs::remove_dir_all(development);
        let _ = fs::remove_dir_all(resource);
    }

    #[test]
    fn runtime_package_selection_falls_back_to_development_resources() {
        let resource = package_fixture("missing-resource", false);
        let development = package_fixture("fallback", true);

        assert_eq!(
            select_runtime_package(&resource, &development).unwrap(),
            development
        );

        let _ = fs::remove_dir_all(resource);
        let _ = fs::remove_dir_all(development);
    }

    #[test]
    fn runtime_package_selection_reports_both_missing_locations() {
        let resource = std::env::temp_dir().join("ruxex-desktop-no-resource");
        let development = std::env::temp_dir().join("ruxex-desktop-no-development");
        let error = select_runtime_package(&resource, &development).unwrap_err();

        assert!(error.contains("bundled Ruxex runtime package not found"));
        assert!(error.contains(&resource.display().to_string()));
        assert!(error.contains(&development.display().to_string()));
    }
}
