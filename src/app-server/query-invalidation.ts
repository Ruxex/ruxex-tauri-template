import type { QueryClient } from "@tanstack/react-query";

import { appServerQueryKeys } from "./query-keys";

export function invalidateThreadList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: appServerQueryKeys.threads });
}

export function invalidateThreadQueries(
  queryClient: QueryClient,
  threadId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: appServerQueryKeys.thread(threadId),
  });
  invalidateThreadList(queryClient);
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
