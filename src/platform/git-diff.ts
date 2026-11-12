import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { isDesktopRuntime } from "../app-server/runtime";

export type GitDiffSummary = {
  added: number;
  deleted: number;
};

export type GitDiffFile = {
  path: string;
  status: "added" | "deleted" | "modified" | "typeChanged";
  added: number;
  deleted: number;
  binary: boolean;
  patch: string | null;
};

export function getGitDiffSummary(
  workspace: string,
): Promise<GitDiffSummary | null> {
  return invoke<GitDiffSummary | null>("git_diff_summary", { workspace });
}

export function getGitDiffDetails(workspace: string): Promise<GitDiffFile[]> {
  return invoke<GitDiffFile[]>("git_diff_details", { workspace });
}

export function useGitDiffSummary(workspace: string | null) {
  return useQuery({
    queryKey: ["platform", "git-diff-summary", workspace],
    queryFn: () => getGitDiffSummary(workspace as string),
    enabled: isDesktopRuntime && Boolean(workspace),
    refetchInterval: 2000,
    retry: false,
  });
}

export function useGitDiffDetails(workspace: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "git-diff-details", workspace],
    queryFn: () => getGitDiffDetails(workspace as string),
    enabled: isDesktopRuntime && Boolean(workspace) && enabled,
    refetchInterval: enabled ? 2000 : false,
    retry: false,
  });
}
