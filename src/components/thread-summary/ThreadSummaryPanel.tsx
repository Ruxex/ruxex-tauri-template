import { TokenUsageSection } from "./TokenUsageSection";
import type { v2 } from "../../protocol";
import type { GitDiffSummary } from "../../platform/git-diff";

type ThreadSummaryPanelProps = {
  tokenUsage: v2.ThreadTokenUsage | null;
  gitDiff: GitDiffSummary | null;
};

export function ThreadSummaryPanel({
  tokenUsage,
  gitDiff,
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
                aria-labelledby="thread-summary-code-changes"
                className={tokenUsage ? "mb-5" : ""}
              >
                <h3
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary"
                  id="thread-summary-code-changes"
                >
                  Code Changes
                </h3>
                <dl className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Added</dt>
                    <dd className="font-medium tabular-nums text-success">
                      +{gitDiff.added}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Deleted</dt>
                    <dd className="font-medium tabular-nums text-error">
                      −{gitDiff.deleted}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            <TokenUsageSection usage={tokenUsage} />
          </div>
        </div>
      </aside>
    </div>
  );
}
