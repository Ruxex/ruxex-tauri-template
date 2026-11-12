use std::fs;
use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffSummary {
    pub added: u64,
    pub deleted: u64,
}

pub fn summary(workspace: &Path) -> Result<GitDiffSummary, String> {
    if !workspace.is_absolute() || !workspace.is_dir() {
        return Err("workspace must be an existing absolute directory".to_string());
    }

    let mut result = GitDiffSummary {
        added: 0,
        deleted: 0,
    };
    let diff = git(
        workspace,
        &["diff", "--no-ext-diff", "--no-renames", "--numstat", "HEAD"],
    )?;
    if !diff.status.success() {
        return Err(String::from_utf8_lossy(&diff.stderr).trim().to_string());
    }
    for line in String::from_utf8_lossy(&diff.stdout).lines() {
        let mut fields = line.splitn(3, '\t');
        if let (Some(added), Some(deleted)) = (fields.next(), fields.next()) {
            result.added += added.parse::<u64>().unwrap_or(0);
            result.deleted += deleted.parse::<u64>().unwrap_or(0);
        }
    }

    let untracked = git(
        workspace,
        &["ls-files", "--others", "--exclude-standard", "-z"],
    )?;
    if !untracked.status.success() {
        return Err(String::from_utf8_lossy(&untracked.stderr)
            .trim()
            .to_string());
    }
    for relative_path in untracked
        .stdout
        .split(|byte| *byte == 0)
        .filter(|path| !path.is_empty())
    {
        let path = workspace.join(path_from_bytes(relative_path));
        let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() {
            result.added += 1;
        } else if metadata.is_file() {
            let contents = fs::read(path).map_err(|error| error.to_string())?;
            if !contents.contains(&0) && !contents.is_empty() {
                result.added += contents.iter().filter(|byte| **byte == b'\n').count() as u64;
                if contents.last() != Some(&b'\n') {
                    result.added += 1;
                }
            }
        }
    }
    Ok(result)
}

#[cfg(unix)]
fn path_from_bytes(bytes: &[u8]) -> std::ffi::OsString {
    use std::os::unix::ffi::OsStrExt;
    std::ffi::OsStr::from_bytes(bytes).to_os_string()
}

#[cfg(windows)]
fn path_from_bytes(bytes: &[u8]) -> std::ffi::OsString {
    use std::os::windows::ffi::OsStringExt;
    std::ffi::OsString::from_wide(
        &String::from_utf8_lossy(bytes)
            .encode_utf16()
            .collect::<Vec<_>>(),
    )
}

fn git(workspace: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .args(args)
        .current_dir(workspace)
        .output()
        .map_err(|error| format!("failed to execute git: {error}"))
}

#[cfg(test)]
mod tests {
    use super::summary;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_REPOSITORY: AtomicU64 = AtomicU64::new(0);

    struct Repository(PathBuf);

    impl Repository {
        fn new() -> Self {
            let unique = NEXT_REPOSITORY.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "ruxex-git-diff-test-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            run_git(&path, &["init", "-q"]);
            run_git(&path, &["config", "user.email", "test@example.com"]);
            run_git(&path, &["config", "user.name", "Ruxex Tests"]);
            fs::write(path.join(".gitignore"), "ignored.txt\n").unwrap();
            fs::write(path.join("tracked.txt"), "one\ntwo\nthree\n").unwrap();
            run_git(&path, &["add", "tracked.txt", ".gitignore"]);
            run_git(&path, &["commit", "-qm", "initial"]);
            Self(path)
        }
    }

    impl Drop for Repository {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn run_git(root: &Path, args: &[&str]) {
        let output = Command::new("git")
            .args(args)
            .current_dir(root)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn counts_staged_and_unstaged_changes_against_head() {
        let repo = Repository::new();
        fs::write(repo.0.join("tracked.txt"), "one\nchanged\n").unwrap();
        run_git(&repo.0, &["add", "tracked.txt"]);
        fs::write(repo.0.join("tracked.txt"), "one\nchanged\nlast\n").unwrap();

        assert_eq!(
            summary(&repo.0).unwrap(),
            super::GitDiffSummary {
                added: 2,
                deleted: 2
            }
        );
    }

    #[test]
    fn counts_non_ignored_untracked_text_and_ignores_binary_and_ignored_files() {
        let repo = Repository::new();
        fs::write(repo.0.join("untracked.txt"), "first\nsecond\n").unwrap();
        fs::write(repo.0.join("ignored.txt"), "ignored\n").unwrap();
        fs::write(repo.0.join("binary.dat"), [0, 1, 2, 0]).unwrap();

        assert_eq!(
            summary(&repo.0).unwrap(),
            super::GitDiffSummary {
                added: 2,
                deleted: 0
            }
        );
    }

    #[test]
    fn rejects_non_repository_workspace() {
        let path = std::env::temp_dir().join(format!("ruxex-not-git-{}", std::process::id()));
        fs::create_dir_all(&path).unwrap();
        assert!(summary(&path).is_err());
        let _ = fs::remove_dir_all(path);
    }
}
