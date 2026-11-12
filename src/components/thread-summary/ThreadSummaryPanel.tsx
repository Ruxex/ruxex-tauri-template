import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { SubagentDetail } from "./SubagentDetail";
import { SubagentsSection } from "./SubagentsSection";

type ThreadSummaryPanelProps = {
  threadId: string;
  open: boolean;
  onClose: () => void;
};

const TBD_SECTIONS = [
  "Sources / Web Search",
  "Changes",
  "Branch details",
  "Git actions",
];

export function ThreadSummaryPanel({
  threadId,
  open,
  onClose,
}: ThreadSummaryPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  return (
    <aside
      aria-label="Thread Summary"
      className="w-full shrink-0 border-base-300 bg-base-100 p-4 lg:w-96 lg:border-l"
      data-testid="thread-summary-panel"
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Thread Summary</h2>
        <button
          aria-label="Close Thread Summary"
          className="btn btn-ghost btn-sm btn-square"
          onClick={onClose}
          type="button"
        >
          <XMarkIcon aria-hidden="true" className="size-5" />
        </button>
      </header>

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
    </aside>
  );
}
