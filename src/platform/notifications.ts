import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { AppServerEvent } from "../app-server/events";

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
  isFocused: () => boolean;
  send: (candidate: NotificationCandidate) => Promise<void>;
};

export function createNotificationDispatcher({
  isFocused,
  send,
}: NotificationDispatcherOptions) {
  const delivered = new Set<string>();

  return {
    async dispatch(event: AppServerEvent): Promise<boolean> {
      const candidate = classifyAppServerEvent(event);
      if (!candidate || isFocused() || delivered.has(candidate.id)) {
        return false;
      }
      await send(candidate);
      delivered.add(candidate.id);
      return true;
    },
  };
}

export async function sendDesktopNotification(
  candidate: NotificationCandidate,
): Promise<void> {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title: candidate.title, body: candidate.body });
  }
}
