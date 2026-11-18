import type { GitDiffReviewTarget } from "@/components/composite/git-diff/GitDiffReviewPane";

export type AppOutletContext = {
  openThreadDiff: (target: GitDiffReviewTarget) => void;
  openThreadTerminal: (target: { threadId: string; cwd: string | null }) => void;
  openSubagentChat: (target: { threadId: string; label: string }) => void;
};
