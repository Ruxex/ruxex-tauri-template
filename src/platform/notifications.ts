import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { AppServerEvent } from "../app-server/events";
import type { UiNotificationSound } from "../app/ui-preferences";

export type NotificationCandidate = {
  id: string;
  title: string;
  body: string;
};

export function classifyAppServerEvent(
  event: AppServerEvent,
): NotificationCandidate | null {
  if (event.type === "disconnected") {
    return {
      id: `disconnected:${event.data.message}`,
      title: "App Server disconnected",
      body: event.data.message,
    };
  }
  if (event.type === "serverRequest") {
    return {
      id: `server-request:${String(event.data.id)}`,
      title: "Action required",
      body: "The App Server is waiting for your approval or input.",
    };
  }
  if (
    event.type === "serverNotification" &&
    event.data.method === "turn/completed"
  ) {
    const params = event.data.params as {
      threadId: string;
      turn: { id: string; status: string };
    };
    return {
      id: `turn-completed:${params.threadId}:${params.turn.id}`,
      title: "Turn completed",
      body: `The turn finished with status: ${params.turn.status}.`,
    };
  }
  return null;
}

export type NotificationDispatcherOptions = {
  enabled?: () => boolean;
  isFocused: () => boolean;
  send: (candidate: NotificationCandidate) => Promise<void>;
};

export function createNotificationDispatcher({
  enabled = () => true,
  isFocused,
  send,
}: NotificationDispatcherOptions) {
  const delivered = new Set<string>();
  const pending = new Set<string>();

  return {
    async dispatch(event: AppServerEvent): Promise<boolean> {
      const candidate = classifyAppServerEvent(event);
      if (
        !candidate ||
        !enabled() ||
        isFocused() ||
        delivered.has(candidate.id) ||
        pending.has(candidate.id)
      ) {
        return false;
      }
      pending.add(candidate.id);
      try {
        await send(candidate);
        delivered.add(candidate.id);
        return true;
      } finally {
        pending.delete(candidate.id);
      }
    },
  };
}

export async function sendDesktopNotification(
  candidate: NotificationCandidate,
  sound: UiNotificationSound = "system",
): Promise<void> {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({
      title: candidate.title,
      body: candidate.body,
      ...(sound === "system" ? {} : { sound }),
    });
  }
}
