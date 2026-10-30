import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useUiPreferences } from "../../app/ui-preferences";
import {
  createNotificationDispatcher,
  sendDesktopNotification,
} from "../../platform/notifications";
import {
  retainThreadState,
  subscribeToAppServerEvents,
  useAppServerEventStore,
  useThreadActivity as useThreadActivitySnapshot,
} from "../event-store";
import { synchronizeAppServerQueries } from "../event-query-sync";
import { isDesktopRuntime } from "../runtime";

export function useAppServerEvents() {
  return useAppServerEventStore();
}

export function useThreadActivity(threadId: string) {
  return useThreadActivitySnapshot(threadId);
}

export function useServerRequests() {
  return Object.values(useAppServerEventStore().pendingServerRequests);
}

export function useRetainThreadState(threadId: string): void {
  useEffect(() => retainThreadState(threadId), [threadId]);
}

export function useAppServerNotifications() {
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
    return subscribeToAppServerEvents((event) => {
      void dispatcher.dispatch(event);
    });
  }, [dispatcher]);
}

export function useAppServerQuerySync(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToAppServerEvents((event) => {
        synchronizeAppServerQueries(queryClient, event);
      }),
    [queryClient],
  );
}
