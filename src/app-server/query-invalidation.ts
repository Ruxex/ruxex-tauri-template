import type { QueryClient } from "@tanstack/react-query";

import type { v2 } from "../protocol";
import { appServerQueryKeys } from "./query-keys";

export function upsertThreadInListCaches(
  queryClient: QueryClient,
  thread: v2.Thread,
): void {
  const cachedLists = queryClient.getQueriesData<v2.ThreadListResponse>({
    queryKey: appServerQueryKeys.threadListRoot,
  });
  let shouldRefreshSearchLists = false;

  for (const [queryKey, data] of cachedLists) {
    if (
      !data ||
      data.data.some((cachedThread) => cachedThread.id === thread.id)
    ) {
      continue;
    }
    const params = queryKey.at(-1) as v2.ThreadListParams | undefined;
    if (params?.searchTerm?.trim()) {
      shouldRefreshSearchLists = true;
      continue;
    }
    if (params?.archived === true) {
      continue;
    }
    if (
      params?.projectId !== undefined &&
      params.projectId !== thread.projectId
    ) {
      continue;
    }
    if (
      params?.parentThreadId !== undefined &&
      params.parentThreadId !== thread.parentThreadId
    ) {
      continue;
    }
    if (
      params?.ancestorThreadId &&
      !hasAncestor(thread, params.ancestorThreadId, data.data)
    ) {
      continue;
    }

    const nextData =
      params?.sortDirection === "asc"
        ? [...data.data, thread]
        : [thread, ...data.data];
    const isAllPagesQuery = queryKey.at(-2) === "all";
    const nextListData =
      !isAllPagesQuery && params?.limit && params.limit > 0
        ? nextData.slice(0, params.limit)
        : nextData;
    queryClient.setQueryData(queryKey, { ...data, data: nextListData });
  }

  if (shouldRefreshSearchLists) {
    invalidateThreadList(queryClient);
  }
}

function hasAncestor(
  thread: v2.Thread,
  ancestorThreadId: string,
  cachedThreads: v2.Thread[],
): boolean {
  const threadsById = new Map(cachedThreads.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let parentThreadId = thread.parentThreadId;

  while (parentThreadId && !visited.has(parentThreadId)) {
    if (parentThreadId === ancestorThreadId) return true;
    visited.add(parentThreadId);
    parentThreadId = threadsById.get(parentThreadId)?.parentThreadId ?? null;
  }

  return false;
}

export function invalidateDescendantThreadLists(
  queryClient: QueryClient,
): void {
  const cachedLists = queryClient.getQueriesData<v2.ThreadListResponse>({
    queryKey: appServerQueryKeys.threadListRoot,
  });
  for (const [queryKey] of cachedLists) {
    const params = queryKey.at(-1) as v2.ThreadListParams | undefined;
    if (params?.ancestorThreadId) {
      void queryClient.invalidateQueries({ queryKey, exact: true });
    }
  }
}

export function upsertSubagentThreadInCache(
  queryClient: QueryClient,
  thread: v2.Thread,
): void {
  const parentThreadId = thread.parentThreadId;
  if (!parentThreadId) return;

  const queryKey = appServerQueryKeys.subagentThreadList(parentThreadId);
  queryClient.setQueryData<v2.ThreadListResponse>(queryKey, (current) => {
    if (!current || current.data.some((item) => item.id === thread.id)) {
      return current;
    }

    return {
      ...current,
      data: [...current.data, thread]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 100),
    };
  });
  void queryClient.invalidateQueries({ queryKey });
}

export function invalidateThreadList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: appServerQueryKeys.threads });
}

export function invalidateThreadConversation(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.threadConversationRoot(threadId),
  });
}

export function invalidateThreadMetadata(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.threadMetadata(threadId),
  });
}

export function invalidateThreadGoal(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.threadGoal(threadId),
  });
}

export function invalidateThreadAttachments(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.threadAttachmentsRoot(threadId),
  });
}

export function invalidateThreadQueue(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.threadQueueRoot(threadId),
  });
}

export function invalidateProjectList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: appServerQueryKeys.projects });
}

export function invalidateProjectQueries(
  queryClient: QueryClient,
  projectId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.project(projectId),
  });
  invalidateProjectList(queryClient);
}
