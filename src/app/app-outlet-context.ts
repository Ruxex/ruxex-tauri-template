import type { GitDiffReviewTarget } from "../components/git-diff/GitDiffReviewPane";

export type AppOutletContext = {
  openThreadDiff: (target: GitDiffReviewTarget) => void;
};
