import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useUiPreferences } from "../../app/ui-preferences";
import {
  createNotificationDispatcher,
  listenForNotificationActions,
  sendDesktopNotification,
} from "../../platform/notifications";
import {
  retainThreadState,
  subscribeToAppServerEvents,
  useAppServerEventStore,
  useThreadActivity as useThreadActivitySnapshot,
} from "../event-store";
import { synchronizeAppServerQueries } from "../event-query-sync";
import { appServerQueryKeys } from "../query-keys";
import { isDesktopRuntime } from "../runtime";
import type { v2 } from "../../protocol";

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

export function useAppServerNotifications(
  openThread: (threadId: string) => void,
) {
  const queryClient = useQueryClient();
  const openThreadRef = useRef(openThread);
  openThreadRef.current = openThread;
  const { preferences } = useUiPreferences();
  const notificationsEnabled = useRef(preferences.notifications.desktop);
  notificationsEnabled.current = preferences.notifications.desktop;
  const notificationSound = useRef(preferences.notifications.sound);
  notificationSound.current = preferences.notifications.sound;
  const notificationLanguage = useRef(preferences.language);
  notificationLanguage.current = preferences.language;
  const dispatcher = useRef(
    createNotificationDispatcher({
      enabled: () => notificationsEnabled.current,
      language: () => notificationLanguage.current,
      threadName: (threadId) =>
        queryClient.getQueryData<v2.ThreadReadResponse>([
          ...appServerQueryKeys.threadMetadata(threadId),
          { includeTurns: false },
        ])?.thread.name,
      isFocused: () => typeof document !== "undefined" && document.hasFocus(),
      send: (candidate) =>
        sendDesktopNotification(candidate, notificationSound.current),
    }),
  ).current;

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenForNotificationActions((threadId) =>
      openThreadRef.current(threadId),
    ).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        stop = unlisten;
      }
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

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
