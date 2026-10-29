import { useEffect, useRef } from "react";

import { useUiPreferences } from "../../app/ui-preferences";
import {
  createNotificationDispatcher,
  sendDesktopNotification,
} from "../../platform/notifications";
import { retainThreadState, useAppServerEventStore } from "../event-store";
import { isDesktopRuntime } from "../runtime";

export function useAppServerEvents() {
  return useAppServerEventStore();
}

export function useServerRequests() {
  return Object.values(useAppServerEventStore().pendingServerRequests);
}

export function useRetainThreadState(threadId: string): void {
  useEffect(() => retainThreadState(threadId), [threadId]);
}

export function useAppServerNotifications() {
  const events = useAppServerEventStore();
  const { preferences } = useUiPreferences();
  const notificationsEnabled = useRef(preferences.notifications.desktop);
  notificationsEnabled.current = preferences.notifications.desktop;
  const notificationSound = useRef(preferences.notifications.sound);
  notificationSound.current = preferences.notifications.sound;
  const dispatcher = useRef(
    createNotificationDispatcher({
      enabled: () => notificationsEnabled.current,
      isFocused: () => typeof document !== "undefined" && document.hasFocus(),
      send: (candidate) =>
        sendDesktopNotification(candidate, notificationSound.current),
    }),
  ).current;

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }
    for (const entry of events.history) {
      void dispatcher.dispatch(entry.event);
    }
  }, [dispatcher, events.history]);
}
