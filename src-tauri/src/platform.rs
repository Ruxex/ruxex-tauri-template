use std::path::{Component, Path};
use url::Url;

pub fn validate_remote_endpoint(value: &str) -> Option<String> {
    let url = Url::parse(value).ok()?;
    if url.username() != ""
        || url.password().is_some()
        || url.path().is_empty()
        || url.query().is_some()
        || url.fragment().is_some()
    {
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

pub fn validate_worktree_path(root: &str, destination: &str) -> bool {
    if !root.starts_with('/')
        || !destination.starts_with('/')
        || root.contains('\\')
        || destination.contains('\\')
    {
        return false;
    }
    let root = Path::new(root);
    let destination = Path::new(destination);
    if root.components().any(is_parent) || destination.components().any(is_parent) {
        return false;
    }
    destination != root && destination.starts_with(root)
}

fn is_parent(component: Component<'_>) -> bool {
    matches!(component, Component::ParentDir)
}

#[cfg(test)]
mod tests {
    use super::{
        image_mime_type, is_path_under_any_root, validate_browser_url, validate_remote_endpoint,
        validate_worktree_path,
    };
    use std::path::Path;

    #[test]
    fn validates_remote_websocket_endpoints() {
        assert_eq!(
            validate_remote_endpoint("wss://example.test/rpc"),
            Some("wss://example.test/rpc".to_string())
        );
        assert_eq!(
            validate_remote_endpoint("ws://127.0.0.1:8080/rpc"),
            Some("ws://127.0.0.1:8080/rpc".to_string())
        );
        assert_eq!(validate_remote_endpoint("ws://example.test/rpc"), None);
        assert_eq!(validate_remote_endpoint("https://example.test/rpc"), None);
    }

    #[test]
    fn validates_browser_urls_and_image_types() {
        assert_eq!(
            validate_browser_url("https://example.test/path?q=1"),
            Some("https://example.test/path?q=1".to_string())
        );
        assert_eq!(validate_browser_url("file:///tmp/secret"), None);
        assert_eq!(validate_browser_url("javascript:alert(1)"), None);
        assert_eq!(image_mime_type(Path::new("capture.PNG")), Some("image/png"));
        assert_eq!(image_mime_type(Path::new("capture.txt")), None);
    }

    #[test]
    fn restricts_image_paths_to_allowed_absolute_roots() {
        let workspace = Path::new("/workspace");
        assert!(is_path_under_any_root(
            Path::new("/workspace/capture.png"),
            &[workspace]
        ));
        assert!(!is_path_under_any_root(
            Path::new("/workspace-other/capture.png"),
            &[workspace]
        ));
        assert!(!is_path_under_any_root(
            Path::new("relative/capture.png"),
            &[workspace]
        ));
    }

    #[test]
    fn keeps_worktree_destinations_under_the_repository_root() {
        assert!(validate_worktree_path(
            "/workspace/repo",
            "/workspace/repo/.worktrees/a"
        ));
        assert!(!validate_worktree_path(
            "/workspace/repo",
            "/workspace/other"
        ));
        assert!(!validate_worktree_path(
            "/workspace/repo",
            "/workspace/repo/../other"
        ));
    }
}
