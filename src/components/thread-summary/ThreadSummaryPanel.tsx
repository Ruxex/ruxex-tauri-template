import { TokenUsageSection } from "./TokenUsageSection";
import { useAppServerEvents } from "../../app-server/hooks";

type ThreadSummaryPanelProps = {
  threadId: string;
};

export function ThreadSummaryPanel({ threadId }: ThreadSummaryPanelProps) {
  const events = useAppServerEvents();
  const tokenUsage = events.threads[threadId]?.tokenUsage ?? null;

  if (!tokenUsage) {
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
            <TokenUsageSection usage={tokenUsage} />
          </div>
        </div>
      </aside>
    </div>
  );
}
