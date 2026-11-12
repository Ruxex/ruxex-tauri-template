# Thread Git Diff Summary Design

## Intent

Show added and deleted line counts for a thread's current uncommitted workspace changes in the existing right-side Thread Summary.

## Scope

- Use the thread's AppServer `cwd` as the workspace path.
- Use a Tauri Rust command to inspect Git; AppServer remains unchanged.
- Count staged and unstaged changes relative to `HEAD`, plus non-ignored untracked text files.
- Refresh counts while the summary is visible so agent edits appear promptly.
- Hide the Git section when the path is not a Git repository or Git cannot provide a summary.

## Approaches

- AppServer Git API: unavailable in the current protocol.
- Frontend shell/Git invocation: unavailable and would violate the desktop boundary.
- Tauri command invoking Git: selected; it follows the existing worktree backend pattern and keeps filesystem/Git access native-side.

## Behavior

The Rust command returns aggregate added/deleted counts for `git diff HEAD` and non-ignored untracked files. Binary files do not contribute line counts. Tauri validates that the supplied workspace exists and resolves inside a Git repository; failures are represented as no summary, not a UI error. The frontend polls the command at a modest interval while the thread summary is mounted.

## Non-goals

No AppServer protocol changes, per-file diff display, historical baseline, ignored-file inclusion, or persistence.

## Design calls

The project already uses the system `git` executable for worktree operations, so this feature reuses that dependency rather than adding a Git library. Staged and unstaged changes are combined against `HEAD`; untracked files are counted separately because Git excludes them from `git diff`.
