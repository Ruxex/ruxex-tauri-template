import { useMemo } from "react";

import {
  useAppServerEvents,
  useServerRequests,
  useSubagentThreadList,
} from "../../app-server/hooks";
import { buildSubagentRows } from "./subagent-model";

type SubagentsSectionProps = {
  parentThreadId: string;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
};

export function SubagentsSection({
  parentThreadId,
  selectedThreadId,
  onSelect,
}: SubagentsSectionProps) {
  const childThreads = useSubagentThreadList(parentThreadId);
  const events = useAppServerEvents();
  const pendingRequests = useServerRequests();
  const rows = useMemo(
    () =>
      buildSubagentRows(
        childThreads.data?.data ?? [],
        events.threads,
        pendingRequests,
      ),
    [childThreads.data?.data, events.threads, pendingRequests],
  );

  if (childThreads.isLoading) {
    return <p className="text-sm text-base-content/60">Loading subagents…</p>;
  }

  if (childThreads.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Unable to load subagents.
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-base-content/60">No subagents yet.</p>;
  }

  const active = rows.filter((row) => row.status === "active");
  const done = rows.filter((row) => row.status !== "active");

  return (
    <div className="space-y-4">
      <AgentGroup
        label="Active"
        rows={active}
        selectedThreadId={selectedThreadId}
        onSelect={onSelect}
      />
      <AgentGroup
        label="Done"
        rows={done}
        selectedThreadId={selectedThreadId}
        onSelect={onSelect}
      />
    </div>
  );
}

function AgentGroup({
  label,
  rows,
  selectedThreadId,
  onSelect,
}: {
  label: string;
  rows: ReturnType<typeof buildSubagentRows>;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
}) {
  return (
    <section aria-labelledby={`subagents-${label.toLowerCase()}`}>
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
        id={`subagents-${label.toLowerCase()}`}
      >
        {label}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-base-content/50">None</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              aria-label={`Open subagent ${row.label}`}
              aria-pressed={selectedThreadId === row.threadId}
              className="w-full rounded-box border border-base-300 p-3 text-left transition hover:border-primary hover:bg-base-200 aria-pressed:border-primary aria-pressed:bg-base-200"
              key={row.threadId}
              onClick={() => onSelect(row.threadId)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{row.label}</span>
                <StatusLabel status={row.status} />
              </span>
              <span className="mt-1 block truncate text-sm text-base-content/70">
                {row.task || "No task summary"}
              </span>
              {row.waitingForApproval && (
                <span className="mt-2 inline-flex text-xs text-warning">
                  Approval needed
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusLabel({
  status,
}: {
  status: "active" | "done" | "failed" | "interrupted";
}) {
  const text =
    status === "active"
      ? "Active"
      : status === "done"
        ? "Done"
        : status === "failed"
          ? "Failed"
          : "Interrupted";
  return <span className="shrink-0 text-xs text-base-content/60">{text}</span>;
}
