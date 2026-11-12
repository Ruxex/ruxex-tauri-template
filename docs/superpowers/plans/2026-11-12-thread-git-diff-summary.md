# Thread Git Diff Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show aggregate added and deleted lines for uncommitted Git changes in the thread summary.

**Architecture:** A Tauri Rust command computes Git counts for the thread workspace. The React summary polls this command while mounted and renders counts alongside token usage.

**Tech Stack:** Rust, Tauri commands, Git CLI, React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-thread-git-diff-summary-design.md`

## Global Constraints

- Leave AppServer protocol and persistence unchanged.
- Reuse system Git executable; do not add dependencies.
- Keep desktop access in the Tauri backend.
- Hide Git summary when unavailable.

## Review Focus

- Staged and unstaged modifications are counted together relative to HEAD — exercise an integration fixture.
- Untracked, ignored, binary, and empty files have expected inclusion/counting behavior — cover fixtures.
- Non-repository workspaces do not produce a UI error — return an unavailable result.
- Thread summary must work when token usage is unavailable — render based on either section.

### Task 1: Rust Git line aggregation

**Files:** Create `src-tauri/src/git_diff.rs`; modify `src-tauri/src/lib.rs`.

- [x] Write integration tests that create temporary repositories with staged, unstaged, untracked, ignored, binary, and non-repository cases.
- [x] Run `make rust-test` and confirm new tests fail for missing `git_diff` API.
- [x] Implement `GitDiffSummary { added: u64, deleted: u64 }` and `summary(workspace: &Path) -> Result<GitDiffSummary, String>` using `git diff HEAD --numstat` plus non-ignored untracked file counts.
- [x] Run `make rust-test` and confirm focused tests pass.

### Task 2: Tauri IPC and frontend query

**Files:** Create `src-tauri/src/git_diff_commands.rs`; modify `src-tauri/src/lib.rs`; create `src/platform/git-diff.ts`.

- [x] Register a `git_diff_summary(workspace: String)` Tauri command returning `{ added, deleted }` or `null` when unavailable.
- [x] Expose a typed React Query hook keyed by workspace and polling every 2 seconds while observed.

### Task 3: Thread summary integration

**Files:** Modify `src/components/conversation/ConversationWorkspace.tsx`, `src/components/thread-summary/ThreadSummaryPanel.tsx`, and associated tests.

- [x] Pass thread `cwd` into the summary panel and show a `Code Changes` section with green additions and red deletions.
- [x] Keep summary visible if either token usage or Git counts are available.
- [x] Add rendering tests for counts and Git-only summary, plus unavailable/non-repository behavior.
- [x] Run `make check-tests`, `make rust-test`, `git diff --check`, and inspect the complete diff.
