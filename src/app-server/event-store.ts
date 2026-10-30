import { useSyncExternalStore } from "react";

import {
  createInitialEventState,
  DEFAULT_IDLE_THREAD_TTL_MS,
  DEFAULT_MAX_IDLE_THREAD_STATES,
  type EventState,
  pruneIdleThreadStates,
  reduceAppServerEvent,
  type ThreadExecutionState,
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
const threadActivitySnapshots = new Map<string, ThreadActivitySnapshot>();

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
  threadActivitySnapshots.clear();
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

export type ThreadActivitySnapshot = {
  status: ThreadExecutionState["status"] | undefined;
  waitingForRequest: boolean;
};

const EMPTY_THREAD_ACTIVITY_SNAPSHOT: ThreadActivitySnapshot = {
  status: undefined,
  waitingForRequest: false,
};

export function useThreadActivity(threadId: string): ThreadActivitySnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getThreadActivitySnapshot(threadId),
    () => EMPTY_THREAD_ACTIVITY_SNAPSHOT,
  );
}

function getThreadActivitySnapshot(threadId: string): ThreadActivitySnapshot {
  const status = snapshot.threads[threadId]?.status;
  const waitingForRequest = Object.values(snapshot.pendingServerRequests).some(
    (request) => request.threadId === threadId,
  );
  const previous = threadActivitySnapshots.get(threadId);
  if (
    previous?.status === status &&
    previous?.waitingForRequest === waitingForRequest
  ) {
    return previous;
  }
  const next = { status, waitingForRequest };
  threadActivitySnapshots.set(threadId, next);
  return next;
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
