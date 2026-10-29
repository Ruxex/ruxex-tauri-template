import type {
  RequestId,
  ServerNotification,
  ServerRequest,
  v2,
} from "../protocol";

import type { AppServerEvent } from "./events";

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
  };
}

export function reduceAppServerEvent(
  state: EventState,
  event: AppServerEvent,
  activityAt = Date.now(),
): EventState {
  const eventId = eventIdentity(event);
  if (state.seenEventIds.has(eventId)) {
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

function reduceNotification(
  state: EventState,
  notification: ServerNotification,
  activityAt: number,
): EventState {
  switch (notification.method) {
    case "turn/started": {
      const { threadId, turn } = notification.params;
      return updateThread(
        state,
        threadId,
        (thread) => ({
          ...thread,
          activeTurnId: turn.id,
          status: "running",
          items: [],
          completedTurn: null,
        }),
        activityAt,
      );
    }
    case "turn/completed": {
      const { threadId, turn } = notification.params;
      return updateThread(
        state,
        threadId,
        (thread) => ({
          ...thread,
          activeTurnId: null,
          status: turnStatus(turn.status),
          completedTurn: turn,
        }),
        activityAt,
      );
    }
    case "item/agentMessage/delta":
      return addDelta(state, notification.params, "agentMessage", activityAt);
    case "item/plan/delta":
      return addDelta(state, notification.params, "plan", activityAt);
    case "item/reasoning/textDelta":
      return addDelta(state, notification.params, "reasoning", activityAt);
    case "item/started":
      return upsertStructuredItem(state, notification.params, activityAt);
    case "item/completed":
      return upsertStructuredItem(state, notification.params, activityAt, true);
    case "item/commandExecution/outputDelta":
      return addDelta(
        state,
        notification.params,
        "commandExecution",
        activityAt,
      );
    case "item/fileChange/outputDelta":
      return addDelta(state, notification.params, "fileChange", activityAt);
    case "item/mcpToolCall/progress":
      return addDelta(
        state,
        {
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: notification.params.message,
        },
        "mcpToolCall",
        activityAt,
      );
    case "serverRequest/resolved": {
      const requestId = requestKey(notification.params.requestId);
      if (!(requestId in state.pendingServerRequests)) {
        return state;
      }
      const pendingServerRequests = { ...state.pendingServerRequests };
      delete pendingServerRequests[requestId];
      return { ...state, pendingServerRequests };
    }
    default:
      return state;
  }
}

function upsertStructuredItem(
  state: EventState,
  params: { threadId: string; turnId: string; item: v2.ThreadItem },
  activityAt: number,
  completed = false,
): EventState {
  return updateThread(
    state,
    params.threadId,
    (thread) => {
      const index = thread.items.findIndex(
        (item) => item.id === params.item.id,
      );
      if (index === -1) {
        const completedWithoutActiveTurn = completed && !thread.activeTurnId;
        return {
          ...thread,
          activeTurnId: completedWithoutActiveTurn
            ? null
            : (thread.activeTurnId ?? params.turnId),
          status: completedWithoutActiveTurn ? "completed" : "running",
          items: [
            ...thread.items,
            {
              id: params.item.id,
              threadId: params.threadId,
              turnId: params.turnId,
              type: params.item.type,
              text: "",
              raw: params.item,
            },
          ],
        };
      }

      const items = [...thread.items];
      items[index] = {
        ...items[index],
        raw: params.item,
        type: params.item.type,
      };
      return { ...thread, items };
    },
    activityAt,
  );
}

function addDelta(
  state: EventState,
  params: { threadId: string; turnId: string; itemId: string; delta: string },
  type: LiveConversationItem["type"],
  activityAt: number,
): EventState {
  return updateThread(
    state,
    params.threadId,
    (thread) => {
      const index = thread.items.findIndex((item) => item.id === params.itemId);
      if (index === -1) {
        return {
          ...thread,
          activeTurnId: thread.activeTurnId ?? params.turnId,
          status: "running",
          items: [
            ...thread.items,
            {
              id: params.itemId,
              threadId: params.threadId,
              turnId: params.turnId,
              type,
              text: params.delta,
            },
          ],
        };
      }

      const item = thread.items[index];
      const items = [...thread.items];
      items[index] = { ...item, text: item.text + params.delta };
      return {
        ...thread,
        activeTurnId: thread.activeTurnId ?? params.turnId,
        status: "running",
        items,
      };
    },
    activityAt,
  );
}

function updateThread(
  state: EventState,
  threadId: string,
  update: (thread: ThreadExecutionState) => ThreadExecutionState,
  activityAt: number,
): EventState {
  const current = state.threads[threadId] ?? {
    threadId,
    activeTurnId: null,
    status: "idle" as const,
    items: [],
    completedTurn: null,
    lastActivityAt: activityAt,
  };
  const nextThread = update(current);
  return {
    ...state,
    threads: {
      ...state.threads,
      [threadId]: { ...nextThread, lastActivityAt: activityAt },
    },
  };
}

function eventIdentity(event: AppServerEvent): string {
  if (event.type === "serverRequest") {
    return `serverRequest:${requestKey(event.data.id)}`;
  }
  return `${event.type}:${stableJson(event.data)}`;
}

function requestKey(requestId: RequestId): string {
  return String(requestId);
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

function turnStatus(status: v2.Turn["status"]): ThreadExecutionState["status"] {
  return status === "inProgress" ? "running" : status;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}
