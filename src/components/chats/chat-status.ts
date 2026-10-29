import type { v2 } from "../../protocol";
import type { ThreadExecutionState } from "../../app-server/event-reducer";

export const CHAT_STATUSES = [
  "running",
  "waiting",
  "completed",
  "failed",
  "stopped",
] as const;

export type ChatStatus = (typeof CHAT_STATUSES)[number];

const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

export function chatStatusLabel(status: ChatStatus): string {
  return CHAT_STATUS_LABELS[status];
}

export function chatStatusClassName(status: ChatStatus): string {
  switch (status) {
    case "running":
      return "badge-info";
    case "waiting":
      return "badge-warning";
    case "completed":
      return "badge-success";
    case "failed":
      return "badge-error";
    case "stopped":
      return "badge-ghost";
  }
}

export function chatStatusFromThreadStatus(
  status: v2.ThreadStatus | undefined,
  liveStatus?: ThreadExecutionState["status"],
  waitingForRequest = false,
): ChatStatus | undefined {
  if (waitingForRequest) return "waiting";
  if (liveStatus === "running") return "running";
  if (liveStatus === "completed") return "completed";
  if (liveStatus === "failed") return "failed";
  if (liveStatus === "interrupted") return "stopped";
  if (!status) return undefined;
  if (status.type === "systemError") return "failed";
  if (status.type !== "active") return undefined;
  return status.activeFlags.some(
    (flag) => flag === "waitingOnApproval" || flag === "waitingOnUserInput",
  )
    ? "waiting"
    : "running";
}
