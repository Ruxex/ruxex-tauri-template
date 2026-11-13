import type { GitDiffReviewTarget } from "../components/git-diff/GitDiffReviewPane";

export type AppOutletContext = {
  openThreadDiff: (target: GitDiffReviewTarget) => void;
  openThreadTerminal: (target: {
    threadId: string;
    cwd: string | null;
  }) => void;
};
