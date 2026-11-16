import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("conversation");

  const childThreads = useSubagentThreadList(parentThreadId);
  const events = useAppServerEvents();
  const pendingRequests = useServerRequests();
  const rows = useMemo(
    () =>
      buildSubagentRows(
        childThreads.data?.data ?? [],
        events.threads,
        pendingRequests,
        t,
      ),
    [childThreads.data?.data, events.threads, pendingRequests, t],
  );

  if (childThreads.isLoading) {
    return (
      <p className="text-sm text-base-content/60">{t("loadingSubagents")}</p>
    );
  }

  if (childThreads.isError) {
    return (
      <p className="alert alert-error" role="alert">
        {t("unableToLoadSubagents")}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-base-content/60">{t("noSubagentsYet")}</p>
    );
  }

  const active = rows.filter((row) => row.status === "active");
  const done = rows.filter((row) => row.status !== "active");

  return (
    <div className="space-y-4">
      <AgentGroup
        label={t("active")}
        rows={active}
        selectedThreadId={selectedThreadId}
        onSelect={onSelect}
      />
      <AgentGroup
        label={t("done")}
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
  const { t } = useTranslation("conversation");

  return (
    <section aria-labelledby={`subagents-${label.toLowerCase()}`}>
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
        id={`subagents-${label.toLowerCase()}`}
      >
        {label}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-base-content/50">{t("none")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              aria-label={t("openSubagent", { name: row.label })}
              aria-pressed={selectedThreadId === row.threadId}
              className="w-full rounded-box border border-base-300 p-3 text-left transition hover:border-primary hover:bg-base-200 aria-pressed:border-primary aria-pressed:bg-base-200"
              key={row.threadId}
              onClick={() => onSelect(row.threadId)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">
                  {row.label}
                </span>
                <StatusLabel status={row.status} />
              </span>
              <span className="mt-1 block truncate text-sm text-base-content/70">
                {row.task || t("noTaskSummary")}
              </span>
              {row.waitingForApproval && (
                <span className="mt-2 inline-flex text-xs text-warning">
                  {t("approvalNeeded")}
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
  const { t } = useTranslation("conversation");

  const text =
    status === "active"
      ? t("active")
      : status === "done"
        ? t("done")
        : status === "failed"
          ? t("failed")
          : t("interrupted");
  return <span className="shrink-0 text-xs text-base-content/60">{text}</span>;
}
