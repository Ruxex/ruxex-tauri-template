import { useState } from "react";

import { SubagentDetail } from "./SubagentDetail";
import { SubagentsSection } from "./SubagentsSection";

type ThreadSummaryPanelProps = {
  threadId: string;
};

const TBD_SECTIONS = [
  "Sources / Web Search",
  "Changes",
  "Branch details",
  "Git actions",
];

export function ThreadSummaryPanel({ threadId }: ThreadSummaryPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  return (
    <aside
      aria-label="Thread Summary"
      className="chat-thread-summary-column chat-side-column sticky top-6 w-full max-w-96 shrink-0 self-start justify-self-end overflow-visible text-sm"
      data-testid="thread-summary-panel"
    >
      <div
        className="h-full max-h-full overflow-y-auto"
        data-testid="thread-summary-scroll"
      >
        <div
          className="h-fit bg-base-100 p-4"
          data-testid="thread-summary-content"
        >
          {selectedThreadId ? (
            <SubagentDetail
              onBack={() => setSelectedThreadId(null)}
              threadId={selectedThreadId}
            />
          ) : (
            <div className="space-y-5">
              <section aria-labelledby="thread-summary-subagents">
                <h3
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary"
                  id="thread-summary-subagents"
                >
                  Subagents
                </h3>
                <SubagentsSection
                  onSelect={setSelectedThreadId}
                  parentThreadId={threadId}
                  selectedThreadId={selectedThreadId}
                />
              </section>
              {TBD_SECTIONS.map((section) => (
                <section
                  aria-label={section}
                  className="border-t border-base-300 pt-4"
                  key={section}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{section}</h3>
                    <span className="badge badge-ghost">TBD</span>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
