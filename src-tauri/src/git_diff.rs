use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffSummary {
    pub added: u64,
    pub deleted: u64,
    pub files: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffFile {
    pub path: String,
    pub status: String,
    pub added: u64,
    pub deleted: u64,
    pub binary: bool,
    pub patch: Option<String>,
}

pub fn summary(workspace: &Path) -> Result<GitDiffSummary, String> {
    if !workspace.is_absolute() || !workspace.is_dir() {
        return Err("workspace must be an existing absolute directory".to_string());
    }

    let mut result = GitDiffSummary {
        added: 0,
        deleted: 0,
        files: 0,
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
            result.files += 1;
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
            result.files += 1;
            result.added += 1;
        } else if metadata.is_file() {
            result.files += 1;
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

pub fn details(workspace: &Path) -> Result<Vec<GitDiffFile>, String> {
    validate_workspace(workspace)?;

    let numstat = git(
        workspace,
        &[
            "diff",
            "--no-ext-diff",
            "--no-renames",
            "--numstat",
            "-z",
            "HEAD",
        ],
    )?;
    ensure_success(&numstat)?;
    let mut files = Vec::<GitDiffFile>::new();
    let mut tracked_paths = Vec::<OsString>::new();
    for record in numstat
        .stdout
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let mut fields = record.splitn(3, |byte| *byte == b'\t');
        let added = fields.next().unwrap_or_default();
        let deleted = fields.next().unwrap_or_default();
        let path = fields.next().unwrap_or_default();
        let binary = added == b"-" || deleted == b"-";
        let path_os = path_from_bytes(path);
        tracked_paths.push(path_os.clone());
        files.push(GitDiffFile {
            path: path_os.to_string_lossy().into_owned(),
            status: "modified".to_string(),
            added: parse_numstat(added),
            deleted: parse_numstat(deleted),
            binary,
            patch: None,
        });
    }

    if !files.is_empty() {
        let tracked = tracked_patch(workspace)?;
        let patches = split_file_patches(&tracked);
        if patches.len() == files.len() {
            for (index, file) in files.iter_mut().enumerate() {
                if !file.binary {
                    file.patch = patches.get(index).cloned();
                }
            }
        } else {
            for (path, file) in tracked_paths.iter().zip(files.iter_mut()) {
                if !file.binary {
                    file.patch = Some(tracked_file_patch(workspace, path)?);
                }
            }
        }
    }

    let name_status = git(
        workspace,
        &["diff", "--name-status", "--no-renames", "-z", "HEAD"],
    )?;
    ensure_success(&name_status)?;
    let records = name_status
        .stdout
        .split(|byte| *byte == 0)
        .collect::<Vec<_>>();
    let mut statuses = HashMap::<OsString, String>::new();
    for record in records.chunks_exact(2) {
        let status = match record[0].first().copied() {
            Some(b'A') => "added",
            Some(b'D') => "deleted",
            Some(b'T') => "typeChanged",
            _ => "modified",
        };
        statuses.insert(path_from_bytes(record[1]), status.to_string());
    }
    for (path, file) in tracked_paths.iter().zip(files.iter_mut()) {
        if let Some(status) = statuses.get(path) {
            file.status = status.clone();
        }
    }

    let untracked = git(
        workspace,
        &["ls-files", "--others", "--exclude-standard", "-z"],
    )?;
    ensure_success(&untracked)?;
    for relative_path in untracked
        .stdout
        .split(|byte| *byte == 0)
        .filter(|path| !path.is_empty())
    {
        let path = path_from_bytes(relative_path);
        let full_path = workspace.join(&path);
        let metadata = fs::symlink_metadata(&full_path).map_err(|error| error.to_string())?;
        let (added, binary) = if metadata.file_type().is_symlink() {
            (1, false)
        } else if metadata.is_file() {
            let contents = fs::read(&full_path).map_err(|error| error.to_string())?;
            if contents.contains(&0) {
                (0, true)
            } else {
                (line_count(&contents), false)
            }
        } else {
            (0, false)
        };
        let patch = if binary {
            None
        } else {
            Some(untracked_patch(workspace, &path)?)
        };
        let binary = binary
            || patch.as_deref().is_some_and(|patch| {
                patch.contains("Binary files ") || patch.contains("GIT binary patch")
            });
        let patch = if binary { None } else { patch };
        files.push(GitDiffFile {
            path: path.to_string_lossy().into_owned(),
            status: "added".to_string(),
            added,
            deleted: 0,
            binary,
            patch,
        });
    }

    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn validate_workspace(workspace: &Path) -> Result<(), String> {
    if !workspace.is_absolute() || !workspace.is_dir() {
        return Err("workspace must be an existing absolute directory".to_string());
    }
    Ok(())
}

fn ensure_success(output: &Output) -> Result<(), String> {
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn parse_numstat(value: &[u8]) -> u64 {
    std::str::from_utf8(value)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0)
}

fn line_count(contents: &[u8]) -> u64 {
    if contents.is_empty() {
        return 0;
    }
    contents.iter().filter(|byte| **byte == b'\n').count() as u64
        + if contents.last() != Some(&b'\n') {
            1
        } else {
            0
        }
}

fn tracked_patch(workspace: &Path) -> Result<String, String> {
    let output = Command::new("git")
        .args([
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--no-renames",
            "--unified=3",
            "HEAD",
        ])
        .current_dir(workspace)
        .output()
        .map_err(|error| format!("failed to execute git: {error}"))?;
    ensure_success(&output)?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn tracked_file_patch(workspace: &Path, path: &OsStr) -> Result<String, String> {
    let output = Command::new("git")
        .args([
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--no-renames",
            "--unified=3",
            "HEAD",
            "--",
        ])
        .arg(path)
        .current_dir(workspace)
        .output()
        .map_err(|error| format!("failed to execute git: {error}"))?;
    ensure_success(&output)?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn split_file_patches(patch: &str) -> Vec<String> {
    let mut files = Vec::<String>::new();
    for line in patch.split_inclusive('\n') {
        if line.starts_with("diff --git ") {
            files.push(String::new());
        }
        if let Some(file) = files.last_mut() {
            file.push_str(line);
        }
    }
    files
}

fn untracked_patch(workspace: &Path, path: &OsStr) -> Result<String, String> {
    let output = Command::new("git")
        .args([
            "diff",
            "--no-index",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--unified=3",
            "--",
            "/dev/null",
        ])
        .arg(path)
        .current_dir(workspace)
        .output()
        .map_err(|error| format!("failed to execute git: {error}"))?;
    if !output.status.success() && output.status.code() != Some(1) {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
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
    use super::{details, summary};
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
                deleted: 2,
                files: 1
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
                deleted: 0,
                files: 2
            }
        );
    }

    #[test]
    fn details_report_tracked_and_untracked_changes() {
        let repo = Repository::new();
        fs::write(repo.0.join("tracked.txt"), "one\nchanged\n").unwrap();
        fs::remove_file(repo.0.join(".gitignore")).unwrap();
        fs::write(repo.0.join("new file.txt"), "first\nsecond\n").unwrap();
        fs::write(repo.0.join("binary.dat"), [0, 1, 2, 0]).unwrap();

        let files = details(&repo.0).unwrap();

        assert_eq!(
            files
                .iter()
                .map(|file| file.path.as_str())
                .collect::<Vec<_>>(),
            [".gitignore", "binary.dat", "new file.txt", "tracked.txt"]
        );
        let deleted = files.iter().find(|file| file.path == ".gitignore").unwrap();
        assert_eq!(deleted.status, "deleted");
        assert!(
            deleted
                .patch
                .as_deref()
                .is_some_and(|patch| patch.contains("-ignored.txt"))
        );

        let binary = files.iter().find(|file| file.path == "binary.dat").unwrap();
        assert!(binary.binary);
        assert!(binary.patch.is_none());

        let added = files
            .iter()
            .find(|file| file.path == "new file.txt")
            .unwrap();
        assert_eq!(added.status, "added");
        assert_eq!(added.added, 2);
        assert!(
            added
                .patch
                .as_deref()
                .is_some_and(|patch| patch.contains("+first"))
        );

        let modified = files
            .iter()
            .find(|file| file.path == "tracked.txt")
            .unwrap();
        assert_eq!(modified.status, "modified");
        assert_eq!((modified.added, modified.deleted), (1, 2));
        assert!(
            modified
                .patch
                .as_deref()
                .is_some_and(|patch| patch.contains("+changed"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn details_preserve_newlines_in_untracked_paths() {
        use std::os::unix::ffi::OsStrExt;

        let repo = Repository::new();
        let path = std::ffi::OsStr::from_bytes(b"new\nfile.txt");
        fs::write(repo.0.join(path), "content\n").unwrap();

        let files = details(&repo.0).unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "new\nfile.txt");
        assert_eq!(files[0].status, "added");
        assert_eq!(files[0].added, 1);
        assert!(
            files[0]
                .patch
                .as_deref()
                .is_some_and(|patch| patch.contains("+content"))
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
