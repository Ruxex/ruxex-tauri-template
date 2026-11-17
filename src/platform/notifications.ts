import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import { i18n, resolveUiLanguage } from "../app/i18n";
import type { UiLanguage } from "../app/ui-preferences";
import type { AppServerEvent } from "../app-server/events";
import type { UiNotificationSound } from "../app/ui-preferences";

export type NotificationCandidate = {
  id: string;
  threadId?: string;
  title: string;
  body: string;
};

const threadIdByNotificationId = new Map<number, string>();
const NOTIFICATION_PREVIEW_LENGTH = 180;

function notificationIdFor(candidate: NotificationCandidate): number {
  let hash = 2166136261;
  for (const character of candidate.id) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

export async function listenForNotificationActions(
  openThread: (threadId: string) => void,
): Promise<() => void> {
  // The installed guest package predates ActionPerformed's type, but its
  // listener event payload is provided by the upgraded Rust plugin.
  const listen = onAction as unknown as (
    callback: (event: {
      actionId: string;
      notification: { id: number } | null;
    }) => void,
  ) => Promise<{ unregister: () => void }>;
  const listener = await listen(({ actionId, notification }) => {
    if (actionId !== "tap" || !notification) {
      return;
    }
    const threadId = threadIdByNotificationId.get(notification.id);
    if (!threadId) {
      return;
    }
    threadIdByNotificationId.delete(notification.id);
    openThread(threadId);
  });
  return () => listener.unregister();
}

export function classifyAppServerEvent(
  event: AppServerEvent,
  language: UiLanguage = i18n.resolvedLanguage === "ja" ? "ja" : "en",
  threadName?: string | null,
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
    const { threadId, turn } = event.data.params;
    const lastReply = [...turn.items]
      .reverse()
      .find((item) => item.type === "agentMessage" && item.text.trim());
    const reply =
      lastReply?.type === "agentMessage"
        ? lastReply.text.replace(/\s+/g, " ").trim()
        : "";
    const replyCharacters = Array.from(reply);
    const replyPreview = replyCharacters
      .slice(0, NOTIFICATION_PREVIEW_LENGTH)
      .join("");
    const emptyReplyMessage =
      turn.status === "failed"
        ? t("notificationFailed")
        : turn.status === "interrupted"
          ? t("notificationInterrupted")
          : t("notificationReplyCompleted");
    const body = replyPreview
      ? `${replyPreview}${replyCharacters.length > NOTIFICATION_PREVIEW_LENGTH ? "…" : ""}`
      : emptyReplyMessage;
    return {
      id: `turn-completed:${threadId}:${turn.id}`,
      threadId,
      title: threadName?.trim() || t("notificationCompleted"),
      body,
    };
  }
  return null;
}

export type NotificationDispatcherOptions = {
  enabled?: () => boolean;
  language?: () => UiLanguage;
  threadName?: (threadId: string) => string | null | undefined;
  isFocused: () => boolean;
  send: (candidate: NotificationCandidate) => Promise<void>;
};

export function createNotificationDispatcher({
  enabled = () => true,
  language = () => (i18n.resolvedLanguage === "ja" ? "ja" : "en"),
  threadName = () => undefined,
  isFocused,
  send,
}: NotificationDispatcherOptions) {
  const delivered = new Set<string>();
  const pending = new Set<string>();

  return {
    async dispatch(event: AppServerEvent): Promise<boolean> {
      const candidate = classifyAppServerEvent(
        event,
        language(),
        event.type === "serverNotification" &&
          event.data.method === "turn/completed"
          ? threadName(event.data.params.threadId)
          : undefined,
      );
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
    const notificationId = notificationIdFor(candidate);
    if (candidate.threadId) {
      threadIdByNotificationId.set(notificationId, candidate.threadId);
      while (threadIdByNotificationId.size > 1000) {
        const oldestId = threadIdByNotificationId.keys().next().value;
        if (oldestId === undefined) {
          break;
        }
        threadIdByNotificationId.delete(oldestId);
      }
    }
    sendNotification({
      id: notificationId,
      title: candidate.title,
      body: candidate.body,
      ...(sound === "system" ? {} : { sound }),
    });
  }
}
