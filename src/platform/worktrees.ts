import { invoke } from "@tauri-apps/api/core";

export type WorktreeRecord = {
  path: string;
  branch: string | null;
  commit: string;
  clean: boolean;
  locked: boolean;
  prunable: boolean;
};

export type WorktreeCreateRequest = {
  root: string;
  destination: string;
  branch: string;
};

export type WorktreeRemoveRequest = {
  root: string;
  path: string;
  force: boolean;
};

export function listWorktrees(root: string): Promise<WorktreeRecord[]> {
  return invoke<WorktreeRecord[]>("worktree_list", { root });
}

export function createWorktree(
  request: WorktreeCreateRequest,
): Promise<WorktreeRecord> {
  return invoke<WorktreeRecord>("worktree_create", { request });
}

export function removeWorktree(request: WorktreeRemoveRequest): Promise<void> {
  return invoke("worktree_remove", { request });
}

export function openWorktree(root: string, path: string): Promise<void> {
  return invoke("worktree_open", { root, path });
}
