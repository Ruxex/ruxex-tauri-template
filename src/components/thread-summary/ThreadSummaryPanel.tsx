import { CodeBracketIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import type { GitDiffSummary } from "../../platform/git-diff";
import type { v2 } from "../../protocol";
import { TokenUsageSection } from "./TokenUsageSection";

type ThreadSummaryPanelProps = {
  tokenUsage: v2.ThreadTokenUsage | null;
  gitDiff: GitDiffSummary | null;
  onReviewGitDiff?: () => void;
  onOpenTerminal?: () => void;
};

export function ThreadSummaryPanel({
  tokenUsage,
  gitDiff,
  onReviewGitDiff,
  onOpenTerminal,
}: ThreadSummaryPanelProps) {
  if (!tokenUsage && !gitDiff) {
    return null;
  }

  return (
    <div className="chat-thread-summary-column chat-side-column sticky top-6 z-10 hidden w-full min-w-0 justify-self-end self-start overflow-hidden @container/summary @min-[80rem]/chat:block">
      <aside
        aria-label="Thread Summary"
        className="ml-auto hidden h-full w-full max-w-72 rounded-box text-xs @min-[16rem]/summary:block"
        data-testid="thread-summary-panel"
      >
        <div
          className="h-full max-h-full overflow-y-auto"
          data-testid="thread-summary-scroll"
        >
          <div
            className="h-fit overflow-hidden rounded-box bg-base-100 p-4"
            data-testid="thread-summary-content"
          >
            {gitDiff && (
              <section
                aria-label="Code changes"
                className={tokenUsage ? "mb-5" : ""}
              >
                {/* Keep change details on one line so the summary stays compact. */}
                <button
                  aria-label={`Review ${gitDiff.added} additions and ${gitDiff.deleted} deletions across ${gitDiff.files} files`}
                  className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={onReviewGitDiff}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-base-content/80">
                    <CodeBracketIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <span>Changes</span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium tabular-nums">
                    <span className="text-success">+{gitDiff.added}</span>
                    <span className="text-error">−{gitDiff.deleted}</span>
                    <span className="text-base-content/60">
                      ({gitDiff.files})
                    </span>
                  </span>
                </button>
              </section>
            )}
            {onOpenTerminal && (
              <section
                aria-label="Terminal"
                className={tokenUsage || gitDiff ? "mb-5" : ""}
              >
                <button
                  aria-label="Open terminal in right pane"
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={onOpenTerminal}
                  type="button"
                >
                  <CommandLineIcon aria-hidden="true" className="size-4" />
                  <span>Terminal</span>
                </button>
              </section>
            )}
            <TokenUsageSection usage={tokenUsage} />
          </div>
        </div>
      </aside>
    </div>
  );
}
