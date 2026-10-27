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
