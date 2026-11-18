import type { TFunction } from "i18next";
import { i18n } from "../../app/i18n";
import type {
  LiveConversationItem,
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";

export type SubagentStatus = "active" | "done" | "failed" | "interrupted";

export type SubagentRow = {
  threadId: string;
  label: string;
  role: string | null;
  task: string;
  status: SubagentStatus;
  summary: string | null;
  updatedAt: number;
  waitingForApproval: boolean;
};

type ParentActivityItem = {
  turnId: string;
  item: v2.ThreadItem;
};

type SubagentActivity = {
  threadId: string;
  status: SubagentStatus;
  agentPath?: string;
  task?: string;
  order: number;
};

export function buildSubagentRows(
  threads: v2.Thread[],
  liveThreads: Record<string, ThreadExecutionState>,
  pendingRequests: PendingServerRequest[],
  t: TFunction = i18n.getFixedT(null, "conversation"),
  activity: {
    history?: readonly ParentActivityItem[];
    live?: readonly LiveConversationItem[];
    parentUpdatedAt?: number;
  } = {},
): SubagentRow[] {
  const waitingThreadIds = new Set(
    pendingRequests
      .map((request) => request.threadId)
      .filter((threadId): threadId is string => Boolean(threadId)),
  );

  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const rows = new Map<string, SubagentRow>();

  for (const thread of threads) {
    const live = liveThreads[thread.id];
    rows.set(thread.id, {
      threadId: thread.id,
      label: subagentLabel(thread.id, t, thread, live),
      role: thread.agentRole,
      task: thread.preview,
      status: subagentStatus(thread.status, live?.status),
      summary: latestAgentSummary(live),
      updatedAt: thread.updatedAt,
      waitingForApproval: waitingThreadIds.has(thread.id),
    });
  }

  const activityItems = mergeParentActivityItems(
    activity.history ?? [],
    activity.live ?? [],
  );
  const latestActivityByThread = new Map<string, SubagentActivity>();

  activityItems.forEach(({ item }, order) => {
    for (const agentActivity of getSubagentActivities(item, order)) {
      if (liveThreads[agentActivity.threadId]?.archived === true) {
        continue;
      }
      const previous = latestActivityByThread.get(agentActivity.threadId);
      latestActivityByThread.set(
        agentActivity.threadId,
        item.type === "subAgentActivity" &&
          item.kind === "interacted" &&
          previous
          ? { ...agentActivity, status: previous.status }
          : agentActivity,
      );
    }
  });

  for (const agentActivity of latestActivityByThread.values()) {
    const threadId = agentActivity.threadId;
    const existing = rows.get(threadId);
    const live = liveThreads[threadId];
    rows.set(threadId, {
      threadId,
      label: subagentLabel(
        threadId,
        t,
        threadById.get(threadId),
        live,
        agentActivity.agentPath,
      ),
      role: existing?.role ?? null,
      task: existing?.task || agentActivity.task || "",
      status:
        agentActivity.status === "active"
          ? (existing?.status ?? liveSubagentStatus(live) ?? "active")
          : agentActivity.status,
      summary: existing?.summary ?? latestAgentSummary(live),
      updatedAt:
        existing?.updatedAt ?? activity.parentUpdatedAt ?? agentActivity.order,
      waitingForApproval:
        existing?.waitingForApproval ?? waitingThreadIds.has(threadId),
    });
  }

  return [...rows.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function subagentLabel(
  threadId: string,
  t: TFunction,
  thread?: v2.Thread,
  live?: ThreadExecutionState,
  agentPath?: string,
): string {
  const pathLabel = agentPath?.split(/[\\/]/).filter(Boolean).at(-1);
  return (
    live?.threadName?.trim() ||
    thread?.name?.trim() ||
    thread?.agentNickname?.trim() ||
    thread?.agentRole?.trim() ||
    pathLabel?.trim() ||
    t("agentFallback", { id: threadId.slice(0, 8) })
  );
}

function mergeParentActivityItems(
  history: readonly ParentActivityItem[],
  live: readonly LiveConversationItem[],
): ParentActivityItem[] {
  const merged = new Map<string, ParentActivityItem>();
  for (const entry of history) {
    const key = `${entry.turnId}:${entry.item.id}`;
    merged.delete(key);
    merged.set(key, entry);
  }
  for (const entry of live) {
    if (entry.raw) {
      const key = `${entry.turnId}:${entry.raw.id}`;
      merged.delete(key);
      merged.set(key, {
        turnId: entry.turnId,
        item: entry.raw,
      });
    }
  }
  return [...merged.values()];
}

function getSubagentActivities(
  item: v2.ThreadItem,
  order: number,
): SubagentActivity[] {
  if (item.type === "subAgentActivity") {
    return [
      {
        threadId: item.agentThreadId,
        status: statusForActivityKind(item.kind),
        agentPath: item.agentPath,
        order,
      },
    ];
  }

  if (item.type !== "collabAgentToolCall" || item.tool !== "spawnAgent") {
    return [];
  }

  return item.receiverThreadIds.map((threadId) => ({
    threadId,
    status: statusForCollabAgent(item, threadId),
    task: item.prompt ?? undefined,
    order,
  }));
}

function statusForActivityKind(
  kind: v2.SubAgentActivityKind,
): SubagentStatus {
  switch (kind) {
    case "started":
      return "active";
    case "interrupted":
      return "interrupted";
    case "completed":
      return "done";
    case "interacted":
      return "active";
  }
}

function statusForCollabAgent(
  item: Extract<v2.ThreadItem, { type: "collabAgentToolCall" }>,
  threadId: string,
): SubagentStatus {
  const agentStatus = item.agentsStates[threadId]?.status;
  switch (agentStatus) {
    case "pendingInit":
    case "running":
      return "active";
    case "interrupted":
    case "shutdown":
      return "interrupted";
    case "completed":
      return "done";
    case "errored":
    case "notFound":
      return "failed";
  }

  switch (item.status) {
    case "inProgress":
      return "active";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "interrupted":
      return "interrupted";
  }
}

function subagentStatus(
  threadStatus: v2.ThreadStatus,
  liveStatus?: ThreadExecutionState["status"],
): SubagentStatus {
  switch (liveStatus) {
    case "running":
    case "resynchronizing":
      return "active";
    case "failed":
      return "failed";
    case "interrupted":
      return "interrupted";
    case "completed":
      return "done";
  }

  switch (threadStatus.type) {
    case "active":
      return "active";
    case "systemError":
      return "failed";
    case "idle":
    case "notLoaded":
      return "done";
  }
}

function liveSubagentStatus(
  live: ThreadExecutionState | undefined,
): SubagentStatus | null {
  if (!live) {
    return null;
  }
  if (live.threadStatus) {
    return subagentStatus(live.threadStatus, live.status);
  }
  switch (live.status) {
    case "running":
    case "resynchronizing":
      return "active";
    case "failed":
      return "failed";
    case "interrupted":
      return "interrupted";
    case "completed":
    case "idle":
      return "done";
  }
}

function latestAgentSummary(
  live: ThreadExecutionState | undefined,
): string | null {
  const message = [...(live?.items ?? [])]
    .reverse()
    .find((item) => item.raw?.type === "agentMessage");
  return message?.text.trim() || null;
}
