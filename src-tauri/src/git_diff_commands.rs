use std::path::Path;

use crate::git_diff::{self, GitDiffSummary};

#[tauri::command]
pub(crate) fn git_diff_summary(workspace: String) -> Option<GitDiffSummary> {
    git_diff::summary(Path::new(&workspace)).ok()
}
