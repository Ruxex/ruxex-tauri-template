use std::path::Path;

use crate::error::{
    CommandResult, DesktopAppServerError, DesktopAppServerErrorKind, command_error,
};
use crate::worktree;

fn worktree_error(message: impl Into<String>) -> DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}

#[tauri::command]
pub(crate) fn worktree_list(root: String) -> CommandResult<Vec<worktree::WorktreeRecord>> {
    worktree::list(Path::new(&root)).map_err(worktree_error)
}

#[tauri::command]
pub(crate) fn worktree_create(
    request: worktree::WorktreeCreateRequest,
) -> CommandResult<worktree::WorktreeRecord> {
    worktree::create(&request).map_err(worktree_error)
}

#[tauri::command]
pub(crate) fn worktree_remove(request: worktree::WorktreeRemoveRequest) -> CommandResult<()> {
    worktree::remove(&request).map_err(worktree_error)
}

#[tauri::command]
pub(crate) fn worktree_open(root: String, path: String) -> CommandResult<()> {
    let exists = worktree::list(Path::new(&root))
        .map_err(worktree_error)?
        .into_iter()
        .any(|worktree| worktree.path == path);
    if !exists {
        return Err(worktree_error(
            "worktree path is not registered in the repository",
        ));
    }
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to open worktree: {error}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{worktree_create, worktree_list, worktree_open, worktree_remove};
    use crate::worktree::{WorktreeCreateRequest, WorktreeRemoveRequest};
    use std::fs;

    #[test]
    fn commands_return_repository_errors_as_command_errors() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-worktree-command-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let root = root.display().to_string();
        assert!(worktree_list(root.clone()).is_err());
        assert!(worktree_open(root.clone(), "/tmp/unknown-worktree".into()).is_err());
        assert!(
            worktree_create(WorktreeCreateRequest {
                root: root.clone(),
                destination: "/tmp/new-worktree".into(),
                branch: "test-branch".into(),
            })
            .is_err()
        );
        assert!(
            worktree_remove(WorktreeRemoveRequest {
                root: root.clone(),
                path: "/tmp/old-worktree".into(),
                force: false,
            })
            .is_err()
        );
        fs::remove_dir_all(root).unwrap();
    }
}
