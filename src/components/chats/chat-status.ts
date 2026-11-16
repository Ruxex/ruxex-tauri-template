import { i18n } from "../../app/i18n";
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

export function chatStatusLabel(status: ChatStatus): string {
  const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
    running: i18n.t("chats:running"),
    waiting: i18n.t("chats:waiting"),
    completed: i18n.t("chats:completed"),
    failed: i18n.t("chats:failed"),
    stopped: i18n.t("chats:stopped"),
  };

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
