import { useSyncExternalStore } from "react";

import {
  createInitialEventState,
  DEFAULT_IDLE_THREAD_TTL_MS,
  DEFAULT_MAX_IDLE_THREAD_STATES,
  type EventState,
  pruneIdleThreadStates,
  reduceAppServerEvent,
} from "./event-reducer";
import { listenToAppServerEvents } from "./events";
import { isDesktopRuntime } from "./runtime";

export type EventSnapshot = EventState;

const listeners = new Set<() => void>();
let snapshot: EventSnapshot = createInitialEventState();
let unlisten: (() => void) | undefined;
let starting: Promise<void> | undefined;
let lifecycleGeneration = 0;
let pruneTimer: ReturnType<typeof setInterval> | undefined;
const retainedThreadIds = new Set<string>();

const EVENT_STATE_PRUNE_INTERVAL_MS = 60_000;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export async function startAppServerEventStore(): Promise<void> {
  if (!isDesktopRuntime || unlisten) {
    return;
  }
  if (starting) {
    return starting;
  }

  const generation = ++lifecycleGeneration;
  const start = (async () => {
    const nextUnlisten = await listenToAppServerEvents((event) => {
      if (generation !== lifecycleGeneration) {
        return;
      }
      snapshot = reduceAppServerEvent(snapshot, event);
      snapshot = pruneIdleThreadStates(snapshot, {
        now: Date.now(),
        retainedThreadIds,
        idleTtlMs: DEFAULT_IDLE_THREAD_TTL_MS,
        maxIdleStates: DEFAULT_MAX_IDLE_THREAD_STATES,
      });
      notify();
    });
    if (generation !== lifecycleGeneration) {
      nextUnlisten();
      return;
    }
    unlisten = nextUnlisten;
    startPruneTimer();
    snapshot = { ...snapshot, connected: true };
    notify();
  })();
  starting = start;
  start.then(
    () => {
      if (starting === start) {
        starting = undefined;
      }
    },
    () => {
      if (starting === start) {
        starting = undefined;
      }
    },
  );
  return start;
}

export function stopAppServerEventStore(): void {
  lifecycleGeneration += 1;
  starting = undefined;
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = undefined;
  }
  retainedThreadIds.clear();
  unlisten?.();
  unlisten = undefined;
  snapshot = { ...createInitialEventState(), connected: false };
  notify();
}

export function retainThreadState(threadId: string): () => void {
  retainedThreadIds.add(threadId);
  return () => retainedThreadIds.delete(threadId);
}

export function getAppServerEventSnapshot(): EventSnapshot {
  return snapshot;
}

export function useAppServerEventStore(): EventSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => createInitialEventState(),
  );
}

function startPruneTimer(): void {
  if (pruneTimer) {
    return;
  }
  pruneTimer = setInterval(() => {
    const nextSnapshot = pruneIdleThreadStates(snapshot, {
      now: Date.now(),
      retainedThreadIds,
      idleTtlMs: DEFAULT_IDLE_THREAD_TTL_MS,
      maxIdleStates: DEFAULT_MAX_IDLE_THREAD_STATES,
    });
    if (nextSnapshot === snapshot) {
      return;
    }
    snapshot = nextSnapshot;
    notify();
  }, EVENT_STATE_PRUNE_INTERVAL_MS);
}
