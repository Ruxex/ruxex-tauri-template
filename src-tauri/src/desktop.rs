use std::fs;
use std::path::{Path, PathBuf};

use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};

use base64::Engine;
use ruxex::ProductIdentity;

use crate::desktop_config::DesktopConfig;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

pub(crate) fn product_identity(config: &DesktopConfig) -> ProductIdentity {
    ProductIdentity::new(
        &config.branding.window_title,
        &config.branding.product_slug,
        &config.branding.home_dir_name,
        &config.branding.home_marker_file,
    )
    .expect("desktop product identity is static and valid")
}

fn ruxex_home_from_user_home(user_home: &Path, config: &DesktopConfig) -> PathBuf {
    product_identity(config)
        .resolve_home_from(user_home)
        .expect("desktop user home should be absolute")
        .into_path_buf()
}

pub(crate) fn ruxex_home() -> Result<PathBuf, String> {
    if let Some(home) = std::env::var_os("RUXEX_HOME") {
        let home = PathBuf::from(home);
        fs::create_dir_all(&home)
            .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
        return Ok(home);
    }
    let user_home =
        dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
    let home = ruxex_home_from_user_home(&user_home, &crate::desktop_config::default_config());
    fs::create_dir_all(&home)
        .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
    Ok(home)
}

pub(crate) fn initialize_provider_home(
    home: &Path,
    identity: &ProductIdentity,
    descriptor: &ruxex::provider::ProviderDescriptor,
) -> Result<(), String> {
    let marker_file = identity.home_marker_file();
    match ruxex::provider::mount_provider_home(home, marker_file, descriptor) {
        Ok(_) => Ok(()),
        Err(ruxex::provider::ProviderHomeError::DescriptorMismatch {
            expected, actual, ..
        }) if actual.provider_kind == "example" && expected.provider_kind == "dummy" => {
            let marker_path = home.join(marker_file);
            let contents = serde_json::to_string_pretty(&expected).map_err(|error| {
                format!("failed to serialize migrated provider marker: {error}")
            })?;
            fs::write(&marker_path, format!("{contents}\n")).map_err(|error| {
                format!(
                    "failed to migrate Desktop provider marker `{}`: {error}",
                    marker_path.display()
                )
            })?;
            Ok(())
        }
        Err(ruxex::provider::ProviderHomeError::MissingMarker { .. }) => {
            let marker_path = home.join(marker_file);
            let marker = ruxex::provider::ProviderHomeMarker::from(descriptor);
            let contents = serde_json::to_string_pretty(&marker)
                .map_err(|error| format!("failed to serialize Desktop provider marker: {error}"))?;
            let mut marker_handle = match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&marker_path)
            {
                Ok(handle) => handle,
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                    return ruxex::provider::mount_provider_home(home, marker_file, descriptor)
                        .map(|_| ())
                        .map_err(|error| {
                            format!("failed to initialize Desktop provider home: {error}")
                        });
                }
                Err(error) => {
                    return Err(format!(
                        "failed to create Desktop provider marker `{}`: {error}",
                        marker_path.display()
                    ));
                }
            };
            if let Err(error) = marker_handle
                .write_all(format!("{contents}\n").as_bytes())
                .and_then(|_| marker_handle.flush())
            {
                let _ = fs::remove_file(&marker_path);
                return Err(format!(
                    "failed to write Desktop provider marker `{}`: {error}",
                    marker_path.display()
                ));
            }
            Ok(())
        }
        Err(error) => Err(format!(
            "failed to initialize Desktop provider home: {error}"
        )),
    }
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
    let user_home = dirs::home_dir().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            "failed to resolve user home directory",
        )
    })?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    let roots = [home, user_home, workspace];
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

#[cfg(test)]
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
    use crate::desktop_config::DesktopConfig;
    use crate::marketplace_assets::{
        detect_marketplace_image_mime, read_marketplace_asset_file_from_roots,
        validate_marketplace_asset_url, validate_marketplace_svg,
    };

    #[cfg(not(feature = "example"))]
    use crate::desktop_config::default_config;

    #[cfg(feature = "example")]
    use super::initialize_provider_home;

    fn test_default_config() -> DesktopConfig {
        #[cfg(feature = "example")]
        {
            return crate::desktop_config::example_provider_config(None);
        }

        #[cfg(not(feature = "example"))]
        {
            default_config()
        }
    }

    #[test]
    fn desktop_home_is_isolated_under_user_home() {
        assert_eq!(
            ruxex_home_from_user_home(Path::new("/home/user"), &test_default_config()),
            Path::new("/home/user/.ruxex_desktop"),
        );
    }

    #[test]
    fn desktop_product_identity_is_separate_from_tui_branding() {
        let config = test_default_config();
        let identity = product_identity(&config);

        assert_eq!(identity.product_name(), "Ruxex Desktop");
        assert_eq!(identity.product_slug(), "ruxex-desktop");
        assert_eq!(identity.home_dir_name(), ".ruxex_desktop");
    }

    #[test]
    fn marketplace_asset_urls_are_limited_to_allowed_https_hosts() {
        assert!(
            validate_marketplace_asset_url(
                "https://raw.githubusercontent.com/acme/plugin/main/logo.svg"
            )
            .is_some()
        );
        for value in [
            "http://raw.githubusercontent.com/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com.evil/acme/plugin/main/logo.svg",
            "https://user@raw.githubusercontent.com/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com:444/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com/acme/plugin/main/logo.svg?x=1",
            "https://raw.githubusercontent.com/acme/plugin/main/logo.svg#x",
            "https://raw.githubusercontent.com/acme/plugin/main/%2e%2e/logo.svg",
            "https://example.com/acme/plugin/main/logo.svg",
        ] {
            assert!(
                validate_marketplace_asset_url(value).is_none(),
                "URL should be rejected: {value}"
            );
        }
    }

    #[test]
    fn marketplace_image_validation_checks_content_and_svg_safety() {
        assert_eq!(
            detect_marketplace_image_mime(b"\x89PNG\r\n\x1a\n"),
            Some("image/png")
        );
        assert_eq!(
            detect_marketplace_image_mime(b"<svg xmlns=\"http://www.w3.org/2000/svg\" />"),
            Some("image/svg+xml")
        );
        assert!(validate_marketplace_svg(b"<svg><path /></svg>").is_ok());
        for value in [
            b"<svg><script>alert(1)</script></svg>".as_slice(),
            b"<svg onload=\"alert(1)\"></svg>".as_slice(),
            b"<svg><use href=\"https://example.com/icon.svg\" /></svg>".as_slice(),
        ] {
            assert!(validate_marketplace_svg(value).is_err());
        }
    }

    #[test]
    fn local_marketplace_asset_reader_revalidates_path_and_bytes() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-marketplace-asset-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("logo.png");
        fs::write(&path, b"\x89PNG\r\n\x1a\n").unwrap();

        let data_url = read_marketplace_asset_file_from_roots(&path, &[root.as_path()]).unwrap();
        assert_eq!(data_url, "data:image/png;base64,iVBORw0KGgo=");
        assert!(
            read_marketplace_asset_file_from_roots(&root.join("missing.png"), &[root.as_path()])
                .is_err()
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(feature = "example")]
    #[test]
    fn dummy_provider_home_initialization_writes_and_validates_marker() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-desktop-provider-home-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();
        let marker_path = home.join(product_identity(&config).home_marker_file());
        let marker = fs::read_to_string(&marker_path).unwrap();
        let marker: serde_json::Value = serde_json::from_str(&marker).unwrap();
        assert_eq!(marker["providerKind"], "dummy");

        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        let _ = fs::remove_dir_all(home);
    }

    #[cfg(feature = "example")]
    #[test]
    fn legacy_example_provider_home_is_migrated_to_dummy() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-desktop-legacy-example-home-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(&home).unwrap();
        fs::write(
            home.join(product_identity(&test_default_config()).home_marker_file()),
            serde_json::json!({
                "formatVersion": 2,
                "providerKind": "example",
                "providerProtocolVersion": ruxex::provider::contract::CURRENT_PROVIDER_PROTOCOL_VERSION,
                "serverSignature": "legacy-example-signature"
            })
            .to_string(),
        )
        .unwrap();

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        let marker: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(home.join(product_identity(&config).home_marker_file())).unwrap(),
        )
        .unwrap();
        assert_eq!(marker["providerKind"], "dummy");
        assert_eq!(marker["serverSignature"], "legacy-example-signature");

        let _ = fs::remove_dir_all(home);
    }

    #[cfg(feature = "example")]
    #[test]
    fn legacy_nonempty_home_is_initialized_without_deleting_data() {
        let home =
            std::env::temp_dir().join(format!("ruxex-desktop-legacy-home-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(home.join("app-server-daemon")).unwrap();
        fs::write(home.join("schedules.json"), "[]\n").unwrap();

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        assert!(home.join("schedules.json").is_file());
        assert!(
            home.join(product_identity(&config).home_marker_file())
                .is_file()
        );

        let _ = fs::remove_dir_all(home);
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
