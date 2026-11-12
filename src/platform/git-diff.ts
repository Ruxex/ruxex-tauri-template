import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { isDesktopRuntime } from "../app-server/runtime";

export type GitDiffSummary = {
  added: number;
  deleted: number;
};

export function getGitDiffSummary(
  workspace: string,
): Promise<GitDiffSummary | null> {
  return invoke<GitDiffSummary | null>("git_diff_summary", { workspace });
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
