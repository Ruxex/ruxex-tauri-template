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

  for (const [queryKey, data] of cachedLists) {
    if (
      !data ||
      data.data.some((cachedThread) => cachedThread.id === thread.id)
    ) {
      continue;
    }
    const params = queryKey.at(-1) as v2.ThreadListParams | undefined;
    if (params?.archived === true) {
      continue;
    }
    if (
      params?.projectId !== undefined &&
      params.projectId !== thread.projectId
    ) {
      continue;
    }

    const nextData =
      params?.sortDirection === "asc"
        ? [...data.data, thread]
        : [thread, ...data.data];
    const limitedData =
      params?.limit && params.limit > 0
        ? nextData.slice(0, params.limit)
        : nextData;
    queryClient.setQueryData(queryKey, { ...data, data: limitedData });
  }
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
