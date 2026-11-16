import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import { i18n, resolveUiLanguage } from "../app/i18n";
import type { UiLanguage } from "../app/ui-preferences";
import type { AppServerEvent } from "../app-server/events";
import type { UiNotificationSound } from "../app/ui-preferences";

export type NotificationCandidate = {
  id: string;
  title: string;
  body: string;
};

export function classifyAppServerEvent(
  event: AppServerEvent,
  language: UiLanguage = i18n.resolvedLanguage === "ja" ? "ja" : "en",
): NotificationCandidate | null {
  const t = i18n.getFixedT(resolveUiLanguage(language), "capabilities");
  if (event.type === "disconnected") {
    return {
      id: `disconnected:${event.data.message}`,
      title: t("notificationDisconnected"),
      body: event.data.message,
    };
  }
  if (event.type === "serverRequest") {
    return {
      id: `server-request:${String(event.data.id)}`,
      title: t("notificationActionRequired"),
      body: t("notificationWaiting"),
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
      title: t("notificationCompleted"),
      body: t("notificationTurnStatus", { status: params.turn.status }),
    };
  }
  return null;
}

export type NotificationDispatcherOptions = {
  enabled?: () => boolean;
  language?: () => UiLanguage;
  isFocused: () => boolean;
  send: (candidate: NotificationCandidate) => Promise<void>;
};

export function createNotificationDispatcher({
  enabled = () => true,
  language = () => (i18n.resolvedLanguage === "ja" ? "ja" : "en"),
  isFocused,
  send,
}: NotificationDispatcherOptions) {
  const delivered = new Set<string>();
  const pending = new Set<string>();

  return {
    async dispatch(event: AppServerEvent): Promise<boolean> {
      const candidate = classifyAppServerEvent(event, language());
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
