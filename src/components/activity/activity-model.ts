import { i18n } from "../../app/i18n";
import type { EventState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";

export type ActivityFilter =
  | "all"
  | "needsAction"
  | "running"
  | "agents"
  | "completed";

export type ActivityEntry = {
  id: string;
  kind: "approval" | "agent" | "thread" | "tool";
  title: string;
  detail: string;
  threadId: string | null;
  status: string;
  timestamp: number;
  needsAction: boolean;
};

export function buildActivityEntries(
  snapshot: EventState,
  threads: v2.Thread[],
): ActivityEntry[] {
  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const entries: ActivityEntry[] = [];

  for (const request of Object.values(snapshot.pendingServerRequests)) {
    entries.push({
      id: `approval-${String(request.requestId)}`,
      kind: "approval",
      title: i18n.t("activity:approvalRequested"),
      detail: request.request.method,
      threadId: request.threadId,
      status: "pending",
      timestamp: 0,
      needsAction: true,
    });
  }

  for (const state of Object.values(snapshot.threads)) {
    const thread = threadById.get(state.threadId);
    const kind = thread?.parentThreadId ? "agent" : "thread";
    const fallbackLabel = i18n.t(
      kind === "agent" ? "activity:agentFallback" : "activity:threadFallback",
      { id: state.threadId.slice(0, 8) },
    );
    const label =
      state.threadName ??
      thread?.name ??
      thread?.agentNickname ??
      thread?.agentRole ??
      fallbackLabel;

    entries.push({
      id: `${kind}-${state.threadId}`,
      kind,
      title:
        kind === "agent"
          ? i18n.t("activity:agentTitle", { name: label })
          : label,
      detail: thread?.preview ?? i18n.t("activity:activityUpdated"),
      threadId: state.threadId,
      status: activityStatus(state.status),
      timestamp: state.lastActivityAt,
      needsAction: false,
    });
  }

  return entries.sort(
    (left, right) =>
      Number(right.needsAction) - Number(left.needsAction) ||
      right.timestamp - left.timestamp,
  );
}

export function filterActivityEntries(
  entries: ActivityEntry[],
  filter: ActivityFilter,
): ActivityEntry[] {
  switch (filter) {
    case "needsAction":
      return entries.filter((entry) => entry.needsAction);
    case "running":
      return entries.filter((entry) => entry.status === "running");
    case "agents":
      return entries.filter((entry) => entry.kind === "agent");
    case "completed":
      return entries.filter((entry) =>
        ["completed", "failed", "interrupted"].includes(entry.status),
      );
    case "all":
      return entries;
  }
}

function activityStatus(
  status:
    | "idle"
    | "running"
    | "completed"
    | "interrupted"
    | "failed"
    | "resynchronizing",
): string {
  return status === "resynchronizing" ? "running" : status;
}
