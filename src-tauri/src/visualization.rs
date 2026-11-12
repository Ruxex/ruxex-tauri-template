use std::fs;
use std::path::{Path, PathBuf};

use crate::desktop::ruxex_home;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

pub(crate) const MAX_VISUALIZATION_BYTES: usize = 1_048_576;

#[tauri::command]
pub(crate) fn read_visualization_file(path: String) -> CommandResult<String> {
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
    let canonical = validate_visualization_path(
        &requested,
        &[home.as_path(), user_home.as_path(), workspace.as_path()],
    )
    .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let bytes = fs::read(&canonical).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read visualization: {error}"),
        )
    })?;
    if bytes.len() > MAX_VISUALIZATION_BYTES {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "visualization exceeds the 1 MiB limit",
        ));
    }
    String::from_utf8(bytes).map_err(|_| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "visualization must be valid UTF-8 HTML",
        )
    })
}

fn validate_visualization_path(path: &Path, roots: &[&Path]) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("visualization path must be absolute".to_string());
    }
    if !is_html_path(path) {
        return Err("only .html visualization files are supported".to_string());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("visualization file cannot be opened: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err("visualization path must be a regular file".to_string());
    }
    if metadata.len() > MAX_VISUALIZATION_BYTES as u64 {
        return Err("visualization exceeds the 1 MiB limit".to_string());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("visualization path cannot be resolved: {error}"))?;
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots
        .iter()
        .map(PathBuf::as_path)
        .collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err("visualization path is outside an allowed root".to_string());
    }
    Ok(canonical)
}

fn is_html_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("html"))
}

#[cfg(test)]
mod tests {
    use super::{MAX_VISUALIZATION_BYTES, validate_visualization_path};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let suffix = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be available")
                .as_nanos();
            let root = std::env::temp_dir().join(format!("ruxex-visualization-{suffix}"));
            fs::create_dir_all(&root).expect("test root should be created");
            Self(root)
        }

        fn path(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn roots(root: &TestRoot) -> [&Path; 1] {
        [root.0.as_path()]
    }

    #[test]
    fn rejects_relative_and_non_html_paths() {
        let root = TestRoot::new();
        assert!(validate_visualization_path(Path::new("chart.html"), &roots(&root)).is_err());
        let txt = root.path("chart.txt");
        fs::write(&txt, "<div>chart</div>").unwrap();
        assert!(validate_visualization_path(&txt, &roots(&root)).is_err());
    }

    #[test]
    fn rejects_directories_symlinks_and_paths_outside_roots() {
        let root = TestRoot::new();
        let directory = root.path("directory.html");
        fs::create_dir(&directory).unwrap();
        assert!(validate_visualization_path(&directory, &roots(&root)).is_err());

        let outside = TestRoot::new();
        let outside_file = outside.path("outside.html");
        fs::write(&outside_file, "<div>outside</div>").unwrap();
        assert!(validate_visualization_path(&outside_file, &roots(&root)).is_err());

        #[cfg(unix)]
        {
            let link = root.path("link.html");
            std::os::unix::fs::symlink(&outside_file, &link).unwrap();
            assert!(validate_visualization_path(&link, &roots(&root)).is_err());
        }
    }

    #[test]
    fn rejects_oversized_files_and_accepts_utf8_html() {
        let root = TestRoot::new();
        let oversized = root.path("large.html");
        fs::write(&oversized, vec![b'x'; MAX_VISUALIZATION_BYTES + 1]).unwrap();
        assert!(validate_visualization_path(&oversized, &roots(&root)).is_err());

        let valid = root.path("valid.HTML");
        fs::write(&valid, "<main>✓</main>").unwrap();
        assert_eq!(
            validate_visualization_path(&valid, &roots(&root)).unwrap(),
            valid.canonicalize().unwrap()
        );
    }
}
