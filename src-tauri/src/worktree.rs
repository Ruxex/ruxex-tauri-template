use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::platform;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeRecord {
    pub path: String,
    pub branch: Option<String>,
    pub commit: String,
    pub clean: bool,
    pub locked: bool,
    pub prunable: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeCreateRequest {
    pub root: String,
    pub destination: String,
    pub branch: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeRemoveRequest {
    pub root: String,
    pub path: String,
    pub force: bool,
}

pub fn list(root: &Path) -> Result<Vec<WorktreeRecord>, String> {
    let root = repository_root(root)?;
    let output = git(&root, ["worktree", "list", "--porcelain"])?;
    parse_worktree_list(&output, &root)
}

pub fn create(request: &WorktreeCreateRequest) -> Result<WorktreeRecord, String> {
    let root = repository_root(Path::new(&request.root))?;
    validate_destination(&root, Path::new(&request.destination))?;
    validate_branch(&request.branch)?;
    let output = git(
        &root,
        [
            "worktree",
            "add",
            "-b",
            request.branch.as_str(),
            request.destination.as_str(),
        ],
    )?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    list(&root)?
        .into_iter()
        .find(|worktree| worktree.path == request.destination)
        .ok_or_else(|| "created worktree was not returned by git".to_string())
}

pub fn remove(request: &WorktreeRemoveRequest) -> Result<(), String> {
    let root = repository_root(Path::new(&request.root))?;
    let destination = Path::new(&request.path);
    validate_destination(&root, destination)?;
    if !destination.is_dir() {
        return Err("worktree path does not exist".to_string());
    }
    if !request.force && !is_clean(destination)? {
        return Err("worktree is dirty; pass force=true to remove it".to_string());
    }
    let mut args = vec!["worktree", "remove"];
    if request.force {
        args.push("--force");
    }
    args.push(request.path.as_str());
    let output = git(&root, args)?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

pub fn validate_branch(branch: &str) -> Result<(), String> {
    if branch.is_empty()
        || branch.starts_with('-')
        || branch.contains("..")
        || branch.contains(' ')
        || branch.contains('~')
        || branch.contains('^')
        || branch.contains(':')
        || branch.contains('?')
        || branch.contains('*')
        || branch.contains('[')
        || branch.ends_with('/')
        || branch.ends_with('.')
    {
        return Err("invalid git branch name".to_string());
    }
    Ok(())
}

fn repository_root(root: &Path) -> Result<PathBuf, String> {
    if !root.is_absolute() {
        return Err("repository root must be absolute".to_string());
    }
    let output = git(root, ["rev-parse", "--show-toplevel"])?;
    if !output.status.success() {
        return Err("path is not a Git repository".to_string());
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    PathBuf::from(value)
        .canonicalize()
        .map_err(|error| format!("failed to resolve Git repository root: {error}"))
}

fn validate_destination(root: &Path, destination: &Path) -> Result<(), String> {
    if !destination.is_absolute()
        || !platform::validate_worktree_path(
            &root.display().to_string(),
            &destination.display().to_string(),
        )
    {
        return Err("worktree destination must stay under the repository root".to_string());
    }
    Ok(())
}

fn parse_worktree_list(
    output: &std::process::Output,
    root: &Path,
) -> Result<Vec<WorktreeRecord>, String> {
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let mut records = Vec::new();
    let mut path: Option<String> = None;
    let mut commit = String::new();
    let mut branch = None;
    let mut locked = false;
    let mut prunable = false;
    let flush = |records: &mut Vec<WorktreeRecord>,
                 path: &mut Option<String>,
                 commit: &mut String,
                 branch: &mut Option<String>,
                 locked: &mut bool,
                 prunable: &mut bool|
     -> Result<(), String> {
        let Some(path_value) = path.take() else {
            return Ok(());
        };
        let path_buf = PathBuf::from(&path_value);
        records.push(WorktreeRecord {
            clean: is_clean(&path_buf)?,
            path: path_value,
            branch: branch.take(),
            commit: std::mem::take(commit),
            locked: *locked,
            prunable: *prunable,
        });
        *locked = false;
        *prunable = false;
        Ok(())
    };
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.is_empty() {
            flush(
                &mut records,
                &mut path,
                &mut commit,
                &mut branch,
                &mut locked,
                &mut prunable,
            )?;
        } else if let Some(value) = line.strip_prefix("worktree ") {
            flush(
                &mut records,
                &mut path,
                &mut commit,
                &mut branch,
                &mut locked,
                &mut prunable,
            )?;
            path = Some(value.to_string());
        } else if let Some(value) = line.strip_prefix("HEAD ") {
            commit = value.to_string();
        } else if let Some(value) = line.strip_prefix("branch refs/heads/") {
            branch = Some(value.to_string());
        } else if line == "locked" {
            locked = true;
        } else if line == "prunable" {
            prunable = true;
        }
    }
    flush(
        &mut records,
        &mut path,
        &mut commit,
        &mut branch,
        &mut locked,
        &mut prunable,
    )?;
    if records.is_empty() && root.exists() {
        return Err("Git returned no worktrees".to_string());
    }
    Ok(records)
}

fn is_clean(path: &Path) -> Result<bool, String> {
    if !path.is_dir() {
        return Ok(false);
    }
    let output = git(path, ["status", "--porcelain"])?;
    Ok(output.status.success() && output.stdout.is_empty())
}

fn git<I, S>(root: &Path, args: I) -> Result<std::process::Output, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|error| format!("failed to execute git: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        WorktreeCreateRequest, WorktreeRemoveRequest, create, list, remove, validate_branch,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn git(root: &PathBuf, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()
            .unwrap();
        assert!(output.status.success(), "{:?}", output);
    }

    fn repository() -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("ruxex-worktree-test-{unique}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-q"]);
        git(&root, &["config", "user.email", "test@example.com"]);
        git(&root, &["config", "user.name", "Ruxex Tests"]);
        fs::write(root.join("README.md"), "test\n").unwrap();
        git(&root, &["add", "README.md"]);
        git(&root, &["commit", "-qm", "initial"]);
        root
    }

    #[test]
    fn creates_lists_and_removes_clean_worktrees() {
        let root = repository();
        let destination = root.join(".worktrees/feature");
        let created = create(&WorktreeCreateRequest {
            root: root.display().to_string(),
            destination: destination.display().to_string(),
            branch: "feature".to_string(),
        })
        .unwrap();
        assert_eq!(created.branch.as_deref(), Some("feature"));
        assert!(
            list(&root)
                .unwrap()
                .iter()
                .any(|worktree| worktree.path == destination.display().to_string())
        );
        remove(&WorktreeRemoveRequest {
            root: root.display().to_string(),
            path: destination.display().to_string(),
            force: false,
        })
        .unwrap();
        assert_eq!(list(&root).unwrap().len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_dirty_removal_without_force_and_rejects_injection() {
        let root = repository();
        let destination = root.join(".worktrees/dirty");
        create(&WorktreeCreateRequest {
            root: root.display().to_string(),
            destination: destination.display().to_string(),
            branch: "dirty".to_string(),
        })
        .unwrap();
        fs::write(destination.join("untracked.txt"), "dirty\n").unwrap();
        let error = remove(&WorktreeRemoveRequest {
            root: root.display().to_string(),
            path: destination.display().to_string(),
            force: false,
        })
        .unwrap_err();
        assert!(error.contains("dirty"));
        assert!(validate_branch("--delete").is_err());
        assert!(validate_branch("feature..bad").is_err());
        remove(&WorktreeRemoveRequest {
            root: root.display().to_string(),
            path: destination.display().to_string(),
            force: true,
        })
        .unwrap();
        let _ = fs::remove_dir_all(root);
    }
}
