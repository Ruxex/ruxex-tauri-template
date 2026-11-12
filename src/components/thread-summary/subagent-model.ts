import type {
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";

export type SubagentStatus =
  | "active"
  | "done"
  | "failed"
  | "interrupted";

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

export function buildSubagentRows(
  threads: v2.Thread[],
  liveThreads: Record<string, ThreadExecutionState>,
  pendingRequests: PendingServerRequest[],
): SubagentRow[] {
  const waitingThreadIds = new Set(
    pendingRequests
      .map((request) => request.threadId)
      .filter((threadId): threadId is string => Boolean(threadId)),
  );

  return [...threads]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((thread) => {
      const live = liveThreads[thread.id];
      const status = subagentStatus(thread.status, live?.status);
      const summary = latestAgentSummary(live);

      return {
        threadId: thread.id,
        label:
          thread.agentNickname ??
          thread.agentRole ??
          `Agent ${thread.id.slice(0, 8)}`,
        role: thread.agentRole,
        task: thread.preview,
        status,
        summary,
        updatedAt: thread.updatedAt,
        waitingForApproval: waitingThreadIds.has(thread.id),
      };
    });
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

function latestAgentSummary(
  live: ThreadExecutionState | undefined,
): string | null {
  const message = [...(live?.items ?? [])]
    .reverse()
    .find((item) => item.raw?.type === "agentMessage");
  return message?.text.trim() || null;
}
