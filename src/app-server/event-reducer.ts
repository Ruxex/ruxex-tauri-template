import type { RequestId, ServerRequest, v2 } from "../protocol";

import type { AppServerEvent } from "./events";
import { reduceNotification } from "./event-notification-reducer";
import { requestKey } from "./event-thread-state";

export type LiveConversationItem = {
  id: string;
  threadId: string;
  turnId: string;
  type: v2.ThreadItem["type"];
  text: string;
  raw?: v2.ThreadItem;
};

export type ThreadExecutionState = {
  threadId: string;
  threadStatus: v2.ThreadStatus | null;
  threadName: string | null;
  archived: boolean | null;
  historyChangedAt: number | null;
  queueChangedAt: number | null;
  activeTurnId: string | null;
  status:
    | "idle"
    | "running"
    | "completed"
    | "interrupted"
    | "failed"
    | "resynchronizing";
  items: LiveConversationItem[];
  completedTurn: v2.Turn | null;
  tokenUsage?: v2.ThreadTokenUsage | null;
  lastActivityAt: number;
};

export type PendingServerRequest = {
  requestId: RequestId;
  kind: "approval" | "userInput" | "elicitation" | "dynamicToolCall" | "other";
  request: ServerRequest;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
};

export type EventHistoryEntry = {
  id: string;
  event: AppServerEvent;
};

export type EventState = {
  connected: boolean;
  resynchronizing: boolean;
  skippedEvents: number;
  lastError: string | null;
  history: EventHistoryEntry[];
  pendingServerRequests: Record<string, PendingServerRequest>;
  threads: Record<string, ThreadExecutionState>;
  seenEventIds: ReadonlySet<string>;
  eventSequence: number;
};

const MAX_HISTORY = 200;
export const DEFAULT_IDLE_THREAD_TTL_MS = 10 * 60_000;
export const DEFAULT_MAX_IDLE_THREAD_STATES = 100;

export type ThreadStatePruneOptions = {
  now: number;
  idleTtlMs?: number;
  maxIdleStates?: number;
  retainedThreadIds?: ReadonlySet<string>;
};

export function createInitialEventState(): EventState {
  return {
    connected: false,
    resynchronizing: false,
    skippedEvents: 0,
    lastError: null,
    history: [],
    pendingServerRequests: {},
    threads: {},
    seenEventIds: new Set(),
    eventSequence: 0,
  };
}

export function reduceAppServerEvent(
  state: EventState,
  event: AppServerEvent,
  activityAt = Date.now(),
): EventState {
  const eventId = eventIdentity(event, state.eventSequence);
  if (event.type === "serverRequest" && state.seenEventIds.has(eventId)) {
    return state;
  }

  const history = [...state.history, { id: eventId, event }].slice(
    -MAX_HISTORY,
  );
  const seenEventIds = new Set(history.map((entry) => entry.id));

  const nextState: EventState = {
    ...state,
    connected: event.type !== "disconnected",
    history,
    seenEventIds,
    eventSequence: state.eventSequence + 1,
  };

  if (event.type === "lagged") {
    return {
      ...nextState,
      connected: true,
      resynchronizing: true,
      skippedEvents: state.skippedEvents + event.data.skipped,
    };
  }

  if (event.type === "disconnected") {
    return {
      ...nextState,
      connected: false,
      resynchronizing: true,
      lastError: event.data.message,
      threads: Object.fromEntries(
        Object.entries(state.threads).map(([threadId, thread]) => [
          threadId,
          {
            ...thread,
            status: thread.activeTurnId ? "resynchronizing" : thread.status,
          },
        ]),
      ),
    };
  }

  if (event.type === "serverRequest") {
    const request = event.data;
    const requestId = request.id;
    const params = request.params as {
      threadId?: string;
      turnId?: string;
      itemId?: string;
    };
    return {
      ...nextState,
      pendingServerRequests: {
        ...state.pendingServerRequests,
        [requestKey(requestId)]: {
          requestId,
          kind: serverRequestKind(request),
          request,
          threadId: params.threadId ?? null,
          turnId: params.turnId ?? null,
          itemId: params.itemId ?? null,
        },
      },
    };
  }

  return reduceNotification(
    { ...nextState, resynchronizing: false },
    event.data,
    activityAt,
  );
}

export function pruneIdleThreadStates(
  state: EventState,
  options: ThreadStatePruneOptions,
): EventState {
  const retainedThreadIds = options.retainedThreadIds ?? new Set<string>();
  const pendingThreadIds = new Set(
    Object.values(state.pendingServerRequests)
      .map((request) => request.threadId)
      .filter((threadId): threadId is string => threadId !== null),
  );
  const idleEntries = Object.entries(state.threads).filter(
    ([threadId, thread]) =>
      !retainedThreadIds.has(threadId) &&
      !pendingThreadIds.has(threadId) &&
      thread.status !== "running" &&
      thread.status !== "resynchronizing",
  );
  const idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_THREAD_TTL_MS;
  const maxIdleStates = Math.max(
    0,
    options.maxIdleStates ?? DEFAULT_MAX_IDLE_THREAD_STATES,
  );
  const staleThreadIds = new Set(
    idleEntries
      .filter(([, thread]) => options.now - thread.lastActivityAt >= idleTtlMs)
      .map(([threadId]) => threadId),
  );
  const overflowCount = Math.max(0, idleEntries.length - maxIdleStates);
  for (const [threadId] of [...idleEntries]
    .sort(([, left], [, right]) => left.lastActivityAt - right.lastActivityAt)
    .slice(0, overflowCount)) {
    staleThreadIds.add(threadId);
  }

  if (staleThreadIds.size === 0) {
    return state;
  }

  const threads = { ...state.threads };
  for (const threadId of staleThreadIds) {
    delete threads[threadId];
  }
  return { ...state, threads };
}

function eventIdentity(event: AppServerEvent, sequence: number): string {
  if (event.type === "serverRequest") {
    return `serverRequest:${requestKey(event.data.id)}`;
  }
  return `${event.type}:${sequence}`;
}

function serverRequestKind(
  request: ServerRequest,
): PendingServerRequest["kind"] {
  const method = typeof request.method === "string" ? request.method : "";
  if (method.includes("requestApproval")) {
    return "approval";
  }
  if (request.method === "item/tool/requestUserInput") {
    return "userInput";
  }
  if (request.method === "mcpServer/elicitation/request") {
    return "elicitation";
  }
  if (request.method === "item/tool/call") {
    return "dynamicToolCall";
  }
  return "other";
}
