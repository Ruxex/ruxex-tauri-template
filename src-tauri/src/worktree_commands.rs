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
