use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde::Serialize;

use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::git_diff::{self, GitDiffSummary};

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitWorkspaceContext {
    pub(crate) workspace_root: String,
    pub(crate) repository_root: Option<String>,
    pub(crate) branch: Option<String>,
    pub(crate) head_commit: Option<String>,
    pub(crate) is_linked_worktree: bool,
    pub(crate) has_uncommitted_changes: bool,
    pub(crate) diff: Option<GitDiffSummary>,
}

pub(crate) fn workspace_context(workspace: &Path) -> CommandResult<GitWorkspaceContext> {
    if !workspace.is_absolute() || !workspace.is_dir() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "workspace must be an existing absolute directory",
        ));
    }
    let workspace_root = workspace.canonicalize().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to resolve workspace: {error}"),
        )
    })?;
    let output = git(&workspace_root, ["rev-parse", "--show-toplevel"].as_slice())?;
    if !output.status.success() {
        return Ok(GitWorkspaceContext {
            workspace_root: workspace_root.display().to_string(),
            repository_root: None,
            branch: None,
            head_commit: None,
            is_linked_worktree: false,
            has_uncommitted_changes: false,
            diff: None,
        });
    }

    let repository_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let repository_root = PathBuf::from(repository_root)
        .canonicalize()
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to resolve Git repository root: {error}"),
            )
        })?;
    let branch_output = git(
        &repository_root,
        ["symbolic-ref", "--quiet", "--short", "HEAD"].as_slice(),
    )?;
    let branch = branch_output.status.success().then(|| {
        String::from_utf8_lossy(&branch_output.stdout)
            .trim()
            .to_string()
    });

    let head_output = git(
        &repository_root,
        ["rev-parse", "--verify", "HEAD"].as_slice(),
    )?;
    let head_commit = head_output.status.success().then(|| {
        String::from_utf8_lossy(&head_output.stdout)
            .trim()
            .to_string()
    });
    let status_output = git(
        &repository_root,
        ["status", "--porcelain=v1", "-z"].as_slice(),
    )?;
    ensure_success(&status_output)?;

    let common_git_dir = resolve_git_path(&repository_root, &["rev-parse", "--git-common-dir"])?;
    let worktree_git_dir =
        resolve_git_path(&repository_root, &["rev-parse", "--absolute-git-dir"])?;
    let diff = head_commit
        .as_ref()
        .map(|_| git_diff::summary(&repository_root))
        .transpose()
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to inspect Git diff: {error}"),
            )
        })?;

    Ok(GitWorkspaceContext {
        workspace_root: workspace_root.display().to_string(),
        repository_root: Some(repository_root.display().to_string()),
        branch,
        head_commit,
        is_linked_worktree: common_git_dir != worktree_git_dir,
        has_uncommitted_changes: !status_output.stdout.is_empty(),
        diff,
    })
}

fn resolve_git_path(root: &Path, args: &[&str]) -> CommandResult<PathBuf> {
    let output = git(root, args)?;
    ensure_success(&output)?;
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let path = PathBuf::from(value);
    let absolute = if path.is_absolute() {
        path
    } else {
        root.join(path)
    };
    absolute.canonicalize().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to resolve Git metadata directory: {error}"),
        )
    })
}

fn git<I, S>(root: &Path, args: I) -> CommandResult<Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to execute git: {error}"),
            )
        })
}

fn ensure_success(output: &Output) -> CommandResult<()> {
    if output.status.success() {
        Ok(())
    } else {
        Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ))
    }
}

#[tauri::command]
pub(crate) fn git_workspace_context(workspace: String) -> CommandResult<GitWorkspaceContext> {
    workspace_context(Path::new(&workspace))
}
