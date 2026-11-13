use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;
use ruxex::provider::transport::{ClientRouteClass, HttpClientFactory, OutboundProxyPolicy};
use url::Url;

use crate::desktop::ruxex_home;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

const MARKETPLACE_ASSET_MAX_BYTES: usize = 8 * 1024 * 1024;
const MARKETPLACE_ASSET_TIMEOUT: Duration = Duration::from_secs(10);

#[tauri::command]
pub(crate) fn read_local_marketplace_asset(path: String) -> CommandResult<String> {
    let requested = PathBuf::from(path);
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
    read_marketplace_asset_file_from_roots(
        &requested,
        &[home.as_path(), user_home.as_path(), workspace.as_path()],
    )
    .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))
}

pub(super) fn read_marketplace_asset_file_from_roots(
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

pub(super) fn validate_marketplace_asset_url(value: &str) -> Option<Url> {
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

pub(super) fn is_allowed_marketplace_image_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/svg+xml" | "image/webp"
    )
}

pub(super) fn detect_marketplace_image_mime(bytes: &[u8]) -> Option<&'static str> {
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

pub(super) fn validate_marketplace_svg(bytes: &[u8]) -> Result<(), String> {
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
