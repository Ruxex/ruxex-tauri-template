import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";
import { ensureThreadResumed } from "../thread-session";

export type ThreadListOptions = {
  enabled?: boolean;
};

export function useThreadList(
  params: v2.ThreadListParams = {},
  options: ThreadListOptions = {},
) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadList(params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/list", params);
      return response.response;
    },
    enabled: Boolean(status.data) && options.enabled !== false,
  });
}

export function useThreadSearch(searchTerm: string) {
  const status = useAppServerStatus();
  const params: v2.ThreadSearchParams = {
    searchTerm,
    limit: 50,
    sortKey: "recency_at",
    sortDirection: "desc",
  };

  return useQuery({
    queryKey: appServerQueryKeys.threadSearch(params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/search", params);
      return response.response;
    },
    enabled: Boolean(status.data && searchTerm.trim()),
  });
}

export function archivedThreadListParams(): v2.ThreadListParams {
  return {
    archived: true,
    limit: 50,
    sortKey: "updated_at",
    sortDirection: "desc",
  };
}

export function useArchivedThreadList() {
  return useThreadList(archivedThreadListParams());
}

export function useThread(threadId: string, includeTurns = false) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: [
      ...appServerQueryKeys.threadMetadata(threadId),
      { includeTurns },
    ],
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/read", {
        threadId,
        includeTurns,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export function useThreadTurns(
  threadId: string,
  params: Omit<v2.ThreadTurnsListParams, "threadId"> = {},
) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadTurns(threadId, params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/turns/list", {
        ...params,
        threadId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export function useThreadItems(
  threadId: string,
  params: Omit<v2.ThreadItemsListParams, "threadId"> = {},
) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadItems(threadId, params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/items/list", {
        ...params,
        threadId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export function useThreadGoal(threadId: string) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadGoal(threadId),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/goal/get", {
        threadId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export function useThreadAttachments(
  threadId: string,
  params: Omit<v2.ThreadAttachmentListParams, "threadId"> = {},
) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadAttachments(threadId, params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/attachment/list", {
        ...params,
        threadId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export function useThreadQueue(
  threadId: string,
  params: Omit<v2.ThreadQueueListParams, "threadId"> = {},
) {
  const status = useAppServerStatus();

  return useQuery({
    queryKey: appServerQueryKeys.threadQueue(threadId, params),
    queryFn: async () => {
      const response = await requestAppServerMethod("thread/queue/list", {
        ...params,
        threadId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && threadId),
  });
}

export type ThreadConversation = {
  thread: v2.ThreadReadResponse["thread"];
  turns: v2.ThreadTurnsListResponse;
  items: v2.ThreadItemsListResponse;
};

export type ThreadConversationOptions = {
  turns?: Omit<v2.ThreadTurnsListParams, "threadId">;
  items?: Omit<v2.ThreadItemsListParams, "threadId">;
};

const EMPTY_TURNS_PARAMS: NonNullable<ThreadConversationOptions["turns"]> = {};
const EMPTY_ITEMS_PARAMS: NonNullable<ThreadConversationOptions["items"]> = {};

export function useThreadConversation(
  threadId: string,
  options: ThreadConversationOptions = {},
) {
  const status = useAppServerStatus();
  const turns = options.turns ?? EMPTY_TURNS_PARAMS;
  const items = options.items ?? EMPTY_ITEMS_PARAMS;
  const enabled = Boolean(status.data && threadId);
  const threadQuery = useQuery({
    queryKey: [
      ...appServerQueryKeys.threadMetadata(threadId),
      { includeTurns: false },
    ],
    queryFn: async () => {
      await ensureThreadResumed(threadId);
      const response = await requestAppServerMethod("thread/read", {
        threadId,
      });
      return response.response;
    },
    enabled,
  });
  const turnsQuery = useQuery({
    queryKey: appServerQueryKeys.threadTurns(threadId, turns),
    queryFn: async () => {
      await ensureThreadResumed(threadId);
      const response = await requestAppServerMethod("thread/turns/list", {
        ...turns,
        threadId,
      });
      return response.response;
    },
    enabled,
  });
  const itemsQuery = useQuery({
    queryKey: appServerQueryKeys.threadItems(threadId, items),
    queryFn: async () => {
      await ensureThreadResumed(threadId);
      const response = await requestAppServerMethod("thread/items/list", {
        ...items,
        threadId,
      });
      return response.response;
    },
    enabled,
  });
  const data: ThreadConversation | undefined =
    threadQuery.data && turnsQuery.data && itemsQuery.data
      ? {
          thread: threadQuery.data.thread,
          turns: turnsQuery.data,
          items: itemsQuery.data,
        }
      : undefined;
  const resync = useCallback(async () => {
    await Promise.all([
      threadQuery.refetch(),
      turnsQuery.refetch(),
      itemsQuery.refetch(),
    ]);
  }, [itemsQuery.refetch, threadQuery.refetch, turnsQuery.refetch]);

  return {
    data,
    error: threadQuery.error ?? turnsQuery.error ?? itemsQuery.error,
    isError: threadQuery.isError || turnsQuery.isError || itemsQuery.isError,
    isFetching:
      threadQuery.isFetching || turnsQuery.isFetching || itemsQuery.isFetching,
    isLoading:
      threadQuery.isLoading || turnsQuery.isLoading || itemsQuery.isLoading,
    isSuccess:
      threadQuery.isSuccess && turnsQuery.isSuccess && itemsQuery.isSuccess,
    resync,
  };
}
