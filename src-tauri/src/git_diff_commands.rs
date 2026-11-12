use std::path::Path;

use crate::git_diff::{self, GitDiffFile, GitDiffSummary};

#[tauri::command]
pub(crate) fn git_diff_summary(workspace: String) -> Option<GitDiffSummary> {
    git_diff::summary(Path::new(&workspace)).ok()
}

#[tauri::command]
pub(crate) fn git_diff_details(workspace: String) -> Result<Vec<GitDiffFile>, String> {
    git_diff::details(Path::new(&workspace))
}
