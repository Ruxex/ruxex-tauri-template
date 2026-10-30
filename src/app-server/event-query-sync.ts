import type { QueryClient } from "@tanstack/react-query";

import type { v2 } from "../protocol";
import { appServerQueryKeys } from "./query-keys";
import type { AppServerEvent } from "./events";
import {
  invalidateThreadConversation,
  invalidateThreadList,
  invalidateThreadMetadata,
  invalidateThreadQueue,
} from "./query-invalidation";

export function synchronizeAppServerQueries(
  queryClient: QueryClient,
  event: AppServerEvent,
): void {
  if (event.type !== "serverNotification") {
    return;
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
      invalidateThreadList(queryClient);
      return;
    case "thread/status/changed":
      patchThreadCaches(queryClient, event.data.params.threadId, {
        status: event.data.params.status,
      });
      return;
    case "thread/name/updated":
      if (event.data.params.threadName === undefined) {
        invalidateThreadMetadata(queryClient, event.data.params.threadId);
        invalidateThreadList(queryClient);
        return;
      }
      patchThreadCaches(queryClient, event.data.params.threadId, {
        name: event.data.params.threadName,
      });
      return;
    case "thread/archived":
    case "thread/unarchived":
      invalidateThreadList(queryClient);
      return;
    case "thread/reverted":
      invalidateThreadConversation(queryClient, event.data.params.threadId);
      invalidateThreadMetadata(queryClient, event.data.params.threadId);
      invalidateThreadList(queryClient);
      return;
    case "thread/deleted":
      queryClient.removeQueries({
        queryKey: appServerQueryKeys.threadMetadata(event.data.params.threadId),
      });
      invalidateThreadList(queryClient);
      return;
    case "thread/queue/changed":
      invalidateThreadQueue(queryClient, event.data.params.threadId);
      return;
    default:
      return;
  }
}

function patchThreadCaches(
  queryClient: QueryClient,
  threadId: string,
  patch: Partial<v2.Thread>,
): void {
  queryClient.setQueriesData<v2.ThreadReadResponse>(
    { queryKey: appServerQueryKeys.threadMetadata(threadId) },
    (data) => (data ? { ...data, thread: { ...data.thread, ...patch } } : data),
  );
  queryClient.setQueriesData<v2.ThreadListResponse>(
    { queryKey: appServerQueryKeys.threadListRoot },
    (data) =>
      data
        ? {
            ...data,
            data: data.data.map((thread) =>
              thread.id === threadId ? { ...thread, ...patch } : thread,
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
                ? { ...result, thread: { ...result.thread, ...patch } }
                : result,
            ),
          }
        : data,
  );
}
