import { useEffect, useRef } from "react";

import { useUiPreferences } from "../../app/ui-preferences";
import { useAppServerEventStore } from "../event-store";
import { isDesktopRuntime } from "../runtime";
import {
  createNotificationDispatcher,
  sendDesktopNotification,
} from "../../platform/notifications";

export function useAppServerEvents() {
  return useAppServerEventStore();
}

export function useServerRequests() {
  return Object.values(useAppServerEventStore().pendingServerRequests);
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
