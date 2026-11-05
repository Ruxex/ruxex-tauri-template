import type { QueryClient } from "@tanstack/react-query";

import type { v2 } from "../protocol";
import { requestAppServerMethod } from "./api";
import type { AppServerEvent } from "./events";
import {
  invalidateThreadConversation,
  invalidateThreadList,
  invalidateThreadMetadata,
  invalidateThreadQueue,
  upsertThreadInListCaches,
} from "./query-invalidation";
import { appServerQueryKeys } from "./query-keys";

type PreviewRefreshState = {
  activeTurnId: string;
  refreshAgain: boolean;
  promise: Promise<void>;
};

const inFlightPreviewRefreshes = new Map<string, PreviewRefreshState>();

export function synchronizeAppServerQueries(
  queryClient: QueryClient,
  event: AppServerEvent,
): Promise<void> {
  if (event.type !== "serverNotification") {
    return Promise.resolve();
  }

  switch (event.data.method) {
    case "thread/started":
      queryClient.setQueriesData<v2.ThreadReadResponse>(
        {
          queryKey: appServerQueryKeys.threadMetadata(
            event.data.params.thread.id,
          ),
        },
        { thread: event.data.params.thread },
      );
      upsertThreadInListCaches(queryClient, event.data.params.thread);
      return Promise.resolve();
    case "thread/status/changed":
      patchThreadCaches(queryClient, event.data.params.threadId, {
        status: event.data.params.status,
      });
      return Promise.resolve();
    case "thread/name/updated":
      if (event.data.params.threadName === undefined) {
        invalidateThreadMetadata(queryClient, event.data.params.threadId);
        invalidateThreadList(queryClient);
        return Promise.resolve();
      }
      patchThreadCaches(queryClient, event.data.params.threadId, {
        name: event.data.params.threadName,
      });
      return Promise.resolve();
    case "thread/archived":
    case "thread/unarchived":
      invalidateThreadList(queryClient);
      return Promise.resolve();
    case "thread/reverted":
      invalidateThreadConversation(queryClient, event.data.params.threadId);
      invalidateThreadMetadata(queryClient, event.data.params.threadId);
      invalidateThreadList(queryClient);
      return Promise.resolve();
    case "thread/deleted":
      queryClient.removeQueries({
        queryKey: appServerQueryKeys.threadMetadata(event.data.params.threadId),
      });
      invalidateThreadList(queryClient);
      return Promise.resolve();
    case "thread/queue/changed":
      invalidateThreadQueue(queryClient, event.data.params.threadId);
      return Promise.resolve();
    case "turn/completed":
      return refreshThreadPreview(
        queryClient,
        event.data.params.threadId,
        event.data.params.turn.id,
      );
    default:
      return Promise.resolve();
  }
}

function refreshThreadPreview(
  queryClient: QueryClient,
  threadId: string,
  turnId: string,
): Promise<void> {
  const existing = inFlightPreviewRefreshes.get(threadId);
  if (existing) {
    if (existing.activeTurnId !== turnId) {
      existing.activeTurnId = turnId;
      existing.refreshAgain = true;
    }
    return existing.promise;
  }

  const state = {
    activeTurnId: turnId,
    refreshAgain: false,
    promise: Promise.resolve(),
  } satisfies Omit<PreviewRefreshState, "promise"> & {
    promise: Promise<void>;
  };
  const refresh = (async () => {
    do {
      state.refreshAgain = false;
      cancelThreadReads(queryClient, threadId);
      const response = await requestAppServerMethod("thread/read", {
        threadId,
      });
      queryClient.setQueryData(
        [
          ...appServerQueryKeys.threadMetadata(threadId),
          { includeTurns: false },
        ],
        response.response,
      );
      const { name: _name, ...previewPatch } = response.response.thread;
      patchThreadCaches(queryClient, threadId, previewPatch, {
        onlyIfNewer: true,
      });
    } while (state.refreshAgain);
  })()
    .catch(() => undefined)
    .finally(() => {
      if (inFlightPreviewRefreshes.get(threadId) === state) {
        inFlightPreviewRefreshes.delete(threadId);
      }
    });
  state.promise = refresh;
  inFlightPreviewRefreshes.set(threadId, state);
  return refresh;
}

function cancelThreadReads(queryClient: QueryClient, threadId: string): void {
  void queryClient.cancelQueries({
    queryKey: appServerQueryKeys.threadMetadata(threadId),
  });
  void queryClient.cancelQueries({
    queryKey: appServerQueryKeys.threadListRoot,
  });
  void queryClient.cancelQueries({
    queryKey: appServerQueryKeys.threadSearchRoot,
  });
}

function patchThreadCaches(
  queryClient: QueryClient,
  threadId: string,
  patch: Partial<v2.Thread>,
  options: { onlyIfNewer?: boolean } = {},
): void {
  queryClient.setQueriesData<v2.ThreadReadResponse>(
    { queryKey: appServerQueryKeys.threadMetadata(threadId) },
    (data) => {
      if (!data || data.thread.id !== threadId) return data;
      return {
        ...data,
        thread: mergeThreadPatch(data.thread, patch, options),
      };
    },
  );
  queryClient.setQueriesData<v2.ThreadListResponse>(
    { queryKey: appServerQueryKeys.threadListRoot },
    (data) =>
      data
        ? {
            ...data,
            data: data.data.map((thread) =>
              thread.id === threadId
                ? mergeThreadPatch(thread, patch, options)
                : thread,
            ),
          }
        : data,
  );
  queryClient.setQueriesData<v2.ThreadSearchResponse>(
    { queryKey: appServerQueryKeys.threadSearchRoot },
    (data) =>
      data
        ? {
            ...data,
            data: data.data.map((result) =>
              result.thread.id === threadId
                ? {
                    ...result,
                    thread: mergeThreadPatch(result.thread, patch, options),
                  }
                : result,
            ),
          }
        : data,
  );
}

function mergeThreadPatch<T extends { updatedAt: number; name: string | null }>(
  thread: T,
  patch: Partial<v2.Thread>,
  options: { onlyIfNewer?: boolean },
): T {
  if (
    options.onlyIfNewer &&
    patch.updatedAt !== undefined &&
    patch.updatedAt < thread.updatedAt
  ) {
    return thread;
  }

  return {
    ...thread,
    ...patch,
    name: patch.name ?? thread.name,
  } as T;
}
