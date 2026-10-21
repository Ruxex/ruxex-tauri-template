use std::path::{Component, Path};
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeepLinkTarget {
    pub kind: &'static str,
    pub id: String,
}

pub fn normalize_deep_link(value: &str) -> Option<DeepLinkTarget> {
    if value.contains("/../") || value.ends_with("/..") || value.contains("\\") {
        return None;
    }
    let url = Url::parse(value).ok()?;
    if url.scheme() != "ruxex" || url.username() != "" || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return None;
    }
    let kind = match url.host_str()? {
        "thread" => "thread",
        "project" => "project",
        _ => return None,
    };
    let mut segments = url.path_segments()?;
    let id = segments.next()?;
    if segments.next().is_some() || !valid_id(id) {
        return None;
    }
    Some(DeepLinkTarget {
        kind,
        id: id.to_string(),
    })
}

pub fn validate_remote_endpoint(value: &str) -> Option<String> {
    let url = Url::parse(value).ok()?;
    if url.username() != "" || url.password().is_some() || url.path().is_empty() || url.query().is_some() || url.fragment().is_some() {
        return None;
    }
    let allowed = match url.scheme() {
        "wss" => true,
        "ws" => matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
        _ => false,
    };
    allowed.then(|| url.to_string())
}

pub fn validate_browser_url(value: &str) -> Option<String> {
    let url = Url::parse(value).ok()?;
    if url.host_str().is_none() || url.username() != "" || url.password().is_some() {
        return None;
    }
    matches!(url.scheme(), "http" | "https").then(|| url.to_string())
}

pub fn is_path_under_any_root(path: &Path, roots: &[&Path]) -> bool {
    path.is_absolute() && roots.iter().any(|root| path.starts_with(root))
}

pub fn image_mime_type(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

pub fn validate_schedule(name: &str, prompt: &str, hour: u8, minute: u8) -> bool {
    !name.trim().is_empty() && name.len() <= 120 && !prompt.trim().is_empty() && hour < 24 && minute < 60
}

pub fn validate_worktree_path(root: &str, destination: &str) -> bool {
    if !root.starts_with('/') || !destination.starts_with('/') || root.contains('\\') || destination.contains('\\') {
        return false;
    }
    let root = Path::new(root);
    let destination = Path::new(destination);
    if root.components().any(is_parent) || destination.components().any(is_parent) {
        return false;
    }
    destination != root && destination.starts_with(root)
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .enumerate()
            .all(|(index, byte)| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'~' | b'-') && index > 0)
}

fn is_parent(component: Component<'_>) -> bool {
    matches!(component, Component::ParentDir)
}

#[cfg(test)]
mod tests {
    use super::{image_mime_type, is_path_under_any_root, normalize_deep_link, validate_browser_url, validate_remote_endpoint, validate_schedule, validate_worktree_path};
    use std::path::Path;

    #[test]
    fn accepts_known_deep_links_and_rejects_other_schemes() {
        assert_eq!(normalize_deep_link("ruxex://thread/thread-1"), Some(super::DeepLinkTarget { kind: "thread", id: "thread-1".to_string() }));
        assert_eq!(normalize_deep_link("ruxex://project/project-1"), Some(super::DeepLinkTarget { kind: "project", id: "project-1".to_string() }));
        assert_eq!(normalize_deep_link("https://thread/thread-1"), None);
        assert_eq!(normalize_deep_link("ruxex://thread/../etc"), None);
    }

    #[test]
    fn validates_remote_websocket_endpoints() {
        assert_eq!(validate_remote_endpoint("wss://example.test/rpc"), Some("wss://example.test/rpc".to_string()));
        assert_eq!(validate_remote_endpoint("ws://127.0.0.1:8080/rpc"), Some("ws://127.0.0.1:8080/rpc".to_string()));
        assert_eq!(validate_remote_endpoint("ws://example.test/rpc"), None);
        assert_eq!(validate_remote_endpoint("https://example.test/rpc"), None);
    }

    #[test]
    fn validates_browser_urls_and_image_types() {
        assert_eq!(validate_browser_url("https://example.test/path?q=1"), Some("https://example.test/path?q=1".to_string()));
        assert_eq!(validate_browser_url("file:///tmp/secret"), None);
        assert_eq!(validate_browser_url("javascript:alert(1)"), None);
        assert_eq!(image_mime_type(Path::new("capture.PNG")), Some("image/png"));
        assert_eq!(image_mime_type(Path::new("capture.txt")), None);
    }

    #[test]
    fn restricts_image_paths_to_allowed_absolute_roots() {
        let workspace = Path::new("/workspace");
        assert!(is_path_under_any_root(Path::new("/workspace/capture.png"), &[workspace]));
        assert!(!is_path_under_any_root(Path::new("/workspace-other/capture.png"), &[workspace]));
        assert!(!is_path_under_any_root(Path::new("relative/capture.png"), &[workspace]));
    }

    #[test]
    fn rejects_invalid_schedules() {
        assert!(validate_schedule("nightly", "run checks", 2, 30));
        assert!(!validate_schedule("bad", "", 25, 0));
    }

    #[test]
    fn keeps_worktree_destinations_under_the_repository_root() {
        assert!(validate_worktree_path("/workspace/repo", "/workspace/repo/.worktrees/a"));
        assert!(!validate_worktree_path("/workspace/repo", "/workspace/other"));
        assert!(!validate_worktree_path("/workspace/repo", "/workspace/repo/../other"));
    }
}
