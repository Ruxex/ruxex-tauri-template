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

#[tauri::command]
pub(crate) fn git_diff_file_patch(workspace: String, path: String) -> Result<String, String> {
    git_diff::file_patch(Path::new(&workspace), Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::{git_diff_details, git_diff_file_patch, git_diff_summary};
    use std::fs;

    #[test]
    fn commands_handle_a_path_that_is_not_a_git_repository() {
        let workspace =
            std::env::temp_dir().join(format!("ruxex-git-diff-commands-{}", std::process::id()));
        fs::create_dir_all(&workspace).unwrap();

        assert!(git_diff_summary(workspace.display().to_string()).is_none());
        assert!(git_diff_details(workspace.display().to_string()).is_err());
        assert!(
            git_diff_file_patch(workspace.display().to_string(), "file.txt".to_string()).is_err()
        );

        fs::remove_dir_all(workspace).unwrap();
    }
}
