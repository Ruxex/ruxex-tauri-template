import type { RequestId } from "../protocol";
import type { EventState, ThreadExecutionState } from "./event-reducer";

export function updateThread(
  state: EventState,
  threadId: string,
  update: (thread: ThreadExecutionState) => ThreadExecutionState,
  activityAt: number,
): EventState {
  const current = state.threads[threadId] ?? {
    threadId,
    threadStatus: null,
    threadName: null,
    archived: null,
    historyChangedAt: null,
    queueChangedAt: null,
    activeTurnId: null,
    status: "idle" as const,
    items: [],
    completedTurn: null,
    tokenUsage: null,
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

export function requestKey(requestId: RequestId): string {
  return String(requestId);
}
