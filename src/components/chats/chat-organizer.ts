import type { ThreadExecutionState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { chatStatusFromThreadStatus, type ChatStatus } from "./chat-status";

export type OrganizableChat = {
  archived?: boolean;
  id: string;
  liveStatus?: ThreadExecutionState["status"];
  name?: string | null;
  pinned?: boolean;
  preview?: string | null;
  status?: v2.ThreadStatus;
  updatedAt: number;
  waitingForRequest?: boolean;
};

export type OrganizedChats<Chat extends OrganizableChat = OrganizableChat> = {
  active: Chat[];
  archived: Chat[];
  pinned: Chat[];
  recent: Chat[];
};

export function chatStatusForOrganization(
  chat: OrganizableChat,
): ChatStatus | undefined {
  return chatStatusFromThreadStatus(
    chat.status,
    chat.liveStatus,
    chat.waitingForRequest,
  );
}

export function organizeChats<Chat extends OrganizableChat>(
  chats: Chat[],
): OrganizedChats<Chat> {
  const result: OrganizedChats<Chat> = {
    active: [],
    archived: [],
    pinned: [],
    recent: [],
  };

  for (const chat of chats) {
    if (chat.archived) {
      result.archived.push(chat);
      continue;
    }
    if (chat.pinned) {
      result.pinned.push(chat);
      continue;
    }
    const status = chatStatusForOrganization(chat);
    if (status === "running" || status === "waiting") {
      result.active.push(chat);
    } else {
      result.recent.push(chat);
    }
  }

  for (const group of Object.values(result)) {
    group.sort((left, right) => right.updatedAt - left.updatedAt);
  }
  return result;
}
