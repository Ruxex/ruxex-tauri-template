import type { v2 } from "../../protocol";
import type { ThreadExecutionState } from "../../app-server/event-reducer";

export const TASK_STATUSES = [
  "running",
  "waiting",
  "completed",
  "failed",
  "stopped",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}

export function taskStatusClassName(status: TaskStatus): string {
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

export function taskStatusFromThreadStatus(
  status: v2.ThreadStatus | undefined,
  liveStatus?: ThreadExecutionState["status"],
  waitingForRequest = false,
): TaskStatus | undefined {
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
