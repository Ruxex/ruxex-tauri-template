import { useEffect, useRef } from "react";

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
  const dispatcher = useRef(
    createNotificationDispatcher({
      isFocused: () => typeof document !== "undefined" && document.hasFocus(),
      send: sendDesktopNotification,
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
