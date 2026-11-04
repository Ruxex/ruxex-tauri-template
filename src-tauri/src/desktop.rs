use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[cfg(feature = "example")]
use std::fs::OpenOptions;
#[cfg(feature = "example")]
use std::io::{ErrorKind, Write};

use base64::Engine;
use ruxex::ProductIdentity;
use ruxex::provider::transport::ClientRouteClass;
use ruxex::provider::transport::HttpClientFactory;
use ruxex::provider::transport::OutboundProxyPolicy;
use url::Url;

#[cfg(feature = "example")]
use ruxex_provider_host_example::dummy_provider;

use crate::branding::BRANDING;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

pub(crate) fn product_identity() -> ProductIdentity {
    ProductIdentity::new(
        BRANDING.window_title,
        BRANDING.product_slug,
        BRANDING.home_dir_name,
        BRANDING.home_marker_file,
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

#[cfg(feature = "example")]
pub(crate) fn initialize_provider_home(home: &Path) -> Result<(), String> {
    let identity = product_identity();
    let marker_file = identity.home_marker_file();
    let descriptor = dummy_provider::provider_factory().1;
    match ruxex::provider::mount_provider_home_with_marker(home, marker_file, &descriptor) {
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
            let marker = ruxex::provider::ProviderHomeMarker::from(&descriptor);
            let contents = serde_json::to_string_pretty(&marker)
                .map_err(|error| format!("failed to serialize Desktop provider marker: {error}"))?;
            let mut marker_handle = match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&marker_path)
            {
                Ok(handle) => handle,
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                    return ruxex::provider::mount_provider_home_with_marker(
                        home,
                        marker_file,
                        &descriptor,
                    )
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

const MARKETPLACE_ASSET_MAX_BYTES: usize = 8 * 1024 * 1024;
const MARKETPLACE_ASSET_TIMEOUT: Duration = Duration::from_secs(10);

#[tauri::command]
pub(crate) fn read_local_marketplace_asset(path: String) -> CommandResult<String> {
    let requested = PathBuf::from(path);
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    read_marketplace_asset_file_from_roots(&requested, &[home.as_path(), workspace.as_path()])
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))
}

fn read_marketplace_asset_file_from_roots(
    requested: &Path,
    roots: &[&Path],
) -> Result<String, String> {
    if !requested.is_absolute() {
        return Err("marketplace image path must be absolute".to_string());
    }
    let metadata = fs::symlink_metadata(requested)
        .map_err(|error| format!("marketplace image path cannot be opened: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err("marketplace image path must be a regular file".to_string());
    }
    if metadata.len() > MARKETPLACE_ASSET_MAX_BYTES as u64 {
        return Err("marketplace image exceeds the size limit".to_string());
    }
    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("marketplace image path cannot be resolved: {error}"))?;
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots
        .iter()
        .map(PathBuf::as_path)
        .collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err("marketplace image path is outside an allowed root".to_string());
    }
    let bytes = fs::read(&canonical)
        .map_err(|error| format!("failed to read marketplace image: {error}"))?;
    if bytes.len() > MARKETPLACE_ASSET_MAX_BYTES {
        return Err("marketplace image exceeds the size limit".to_string());
    }
    let mime = detect_marketplace_image_mime(&bytes)
        .ok_or_else(|| "marketplace image type is not supported".to_string())?;
    if mime == "image/svg+xml" {
        validate_marketplace_svg(&bytes)?;
    }
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub(crate) async fn read_marketplace_asset(url: String) -> CommandResult<String> {
    let requested_url = validate_marketplace_asset_url(&url).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image URL is not allowed",
        )
    })?;
    let client_factory = HttpClientFactory::new(OutboundProxyPolicy::ReqwestDefault);
    let client = client_factory
        .build_client_without_request_logging(requested_url.as_str(), ClientRouteClass::Other)
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to initialize marketplace image client: {error}"),
            )
        })?;
    let response = client
        .get(requested_url.as_str())
        .timeout(MARKETPLACE_ASSET_TIMEOUT)
        .send()
        .await
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to fetch marketplace image: {error}"),
            )
        })?;
    if !response.status().is_success()
        || validate_marketplace_asset_url(response.url().as_str()).is_none()
    {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image response is not allowed",
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MARKETPLACE_ASSET_MAX_BYTES as u64)
    {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image exceeds the size limit",
        ));
    }

    let declared_mime = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::to_ascii_lowercase);
    let bytes = response.bytes().await.map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read marketplace image: {error}"),
        )
    })?;
    if bytes.len() > MARKETPLACE_ASSET_MAX_BYTES {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image exceeds the size limit",
        ));
    }

    let detected_mime = detect_marketplace_image_mime(&bytes);
    let mime = detected_mime.or_else(|| {
        declared_mime
            .as_deref()
            .filter(|mime| is_allowed_marketplace_image_mime(mime))
    });
    let Some(mime) = mime else {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image type is not supported",
        ));
    };
    if let Some(declared_mime) = declared_mime.as_deref()
        && is_allowed_marketplace_image_mime(declared_mime)
        && declared_mime != mime
    {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "marketplace image content type is inconsistent",
        ));
    }
    if mime == "image/svg+xml" {
        validate_marketplace_svg(&bytes)
            .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    }

    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

fn validate_marketplace_asset_url(value: &str) -> Option<Url> {
    let url = Url::parse(value).ok()?;
    if url.scheme() != "https"
        || !matches!(
            url.host_str(),
            Some("github.com") | Some("raw.githubusercontent.com")
        )
        || url.username() != ""
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path().contains('%')
        || url.path().contains('\\')
    {
        return None;
    }
    let segments = url.path_segments()?.collect::<Vec<_>>();
    if segments.len() < 4
        || segments.iter().any(|segment| {
            segment.is_empty()
                || *segment == "."
                || *segment == ".."
                || segment.chars().any(|character| character.is_control())
        })
    {
        return None;
    }
    Some(url)
}

fn is_allowed_marketplace_image_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/svg+xml" | "image/webp"
    )
}

fn detect_marketplace_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png");
    }
    if bytes.starts_with(b"\xff\xd8\xff") {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.len() >= 12
        && &bytes[4..8] == b"ftyp"
        && [b"avif".as_slice(), b"avis", b"mif1", b"msf1"]
            .iter()
            .any(|brand| &bytes[8..12] == *brand)
    {
        return Some("image/avif");
    }
    let text = std::str::from_utf8(bytes)
        .ok()?
        .trim_start_matches('\u{feff}')
        .trim_start();
    if text.starts_with("<svg") || (text.starts_with("<?xml") && text.contains("<svg")) {
        return Some("image/svg+xml");
    }
    None
}

fn validate_marketplace_svg(bytes: &[u8]) -> Result<(), String> {
    let text =
        std::str::from_utf8(bytes).map_err(|_| "marketplace SVG is not valid UTF-8".to_string())?;
    let lower = text.to_ascii_lowercase();
    if !lower.contains("<svg")
        || [
            "<!doctype",
            "<!entity",
            "<script",
            "<foreignobject",
            "<iframe",
            "<object",
            "<embed",
            "<audio",
            "<video",
            "javascript:",
            "data:",
            "url(",
            "href=",
            "onload=",
            "onerror=",
            "onclick=",
        ]
        .iter()
        .any(|marker| lower.contains(marker))
    {
        return Err("marketplace SVG contains unsafe content".to_string());
    }
    Ok(())
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

    use super::{
        detect_marketplace_image_mime, product_identity, read_marketplace_asset_file_from_roots,
        ruxex_home_from_user_home, select_runtime_package, validate_marketplace_asset_url,
        validate_marketplace_svg,
    };

    #[cfg(feature = "example")]
    use super::initialize_provider_home;

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

        initialize_provider_home(&home).unwrap();
        let marker_path = home.join(product_identity().home_marker_file());
        let marker = fs::read_to_string(&marker_path).unwrap();
        let marker: serde_json::Value = serde_json::from_str(&marker).unwrap();
        assert_eq!(marker["providerKind"], "dummy");

        initialize_provider_home(&home).unwrap();

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
            home.join(product_identity().home_marker_file()),
            serde_json::json!({
                "formatVersion": 2,
                "providerKind": "example",
                "providerProtocolVersion": ruxex::provider::contract::CURRENT_PROVIDER_PROTOCOL_VERSION,
                "serverSignature": "legacy-example-signature"
            })
            .to_string(),
        )
        .unwrap();

        initialize_provider_home(&home).unwrap();

        let marker: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(home.join(product_identity().home_marker_file())).unwrap(),
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

        initialize_provider_home(&home).unwrap();

        assert!(home.join("schedules.json").is_file());
        assert!(home.join(product_identity().home_marker_file()).is_file());

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
