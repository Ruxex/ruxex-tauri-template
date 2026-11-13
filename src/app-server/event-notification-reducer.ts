import type { ServerNotification, v2 } from "../protocol";
import { requestKey, updateThread } from "./event-thread-state";
import type {
  EventState,
  LiveConversationItem,
  ThreadExecutionState,
} from "./event-reducer";

export function reduceNotification(
  state: EventState,
  notification: ServerNotification,
  activityAt: number,
): EventState {
  switch (notification.method) {
    case "thread/started": {
      const { thread } = notification.params;
      return updateThread(
        state,
        thread.id,
        (current) => ({
          ...current,
          threadStatus: thread.status,
          threadName: thread.name,
          archived: false,
        }),
        activityAt,
      );
    }
    case "thread/status/changed":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, threadStatus: notification.params.status }),
        activityAt,
      );
    case "thread/name/updated":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({
          ...thread,
          threadName: notification.params.threadName ?? null,
        }),
        activityAt,
      );
    case "thread/archived":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, archived: true }),
        activityAt,
      );
    case "thread/unarchived":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, archived: false }),
        activityAt,
      );
    case "thread/reverted":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, historyChangedAt: activityAt }),
        activityAt,
      );
    case "thread/queue/changed":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, queueChangedAt: activityAt }),
        activityAt,
      );
    case "thread/tokenUsage/updated":
      return updateThread(
        state,
        notification.params.threadId,
        (thread) => ({ ...thread, tokenUsage: notification.params.tokenUsage }),
        activityAt,
      );
    case "turn/started": {
      const { threadId, turn } = notification.params;
      return updateThread(
        state,
        threadId,
        (thread) => ({
          ...thread,
          activeTurnId: turn.id,
          status: "running",
          items: thread.items,
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
    case "item/reasoning/summaryTextDelta":
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
    case "item/fileChange/patchUpdated":
      return updateFileChangeItem(state, notification.params, activityAt);
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

function updateFileChangeItem(
  state: EventState,
  params: {
    threadId: string;
    turnId: string;
    itemId: string;
    changes: v2.FileUpdateChange[];
  },
  activityAt: number,
): EventState {
  return updateThread(
    state,
    params.threadId,
    (thread) => ({
      ...thread,
      items: thread.items.map((item) =>
        item.id === params.itemId &&
        item.turnId === params.turnId &&
        item.raw?.type === "fileChange"
          ? { ...item, raw: { ...item.raw, changes: params.changes } }
          : item,
      ),
    }),
    activityAt,
  );
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
        (item) => item.id === params.item.id && item.turnId === params.turnId,
      );
      if (index === -1) {
        if (completed && params.item.type === "agentMessage") {
          let streamedIndex = -1;
          for (
            let itemIndex = thread.items.length - 1;
            itemIndex >= 0;
            itemIndex -= 1
          ) {
            const item = thread.items[itemIndex];
            if (
              item.turnId === params.turnId &&
              item.type === "agentMessage" &&
              item.raw === undefined
            ) {
              streamedIndex = itemIndex;
              break;
            }
          }
          if (streamedIndex !== -1) {
            const items = [...thread.items];
            items[streamedIndex] = {
              id: params.item.id,
              threadId: params.threadId,
              turnId: params.turnId,
              type: params.item.type,
              text: params.item.text,
              raw: params.item,
            };
            return { ...thread, items };
          }
        }
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
              text:
                completed && params.item.type === "agentMessage"
                  ? params.item.text
                  : "",
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
        ...(completed && params.item.type === "agentMessage"
          ? { text: params.item.text }
          : {}),
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
      const index = thread.items.findIndex(
        (item) => item.id === params.itemId && item.turnId === params.turnId,
      );
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

function turnStatus(status: v2.Turn["status"]): ThreadExecutionState["status"] {
  return status === "inProgress" ? "running" : status;
}
