import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import {
  invalidateProjectList,
  invalidateProjectQueries,
} from "../query-invalidation";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";
import { useAllThreadList, useThreadList } from "./useThreadQueries";

export function useProjectList(
  params: v2.ProjectListParams = {},
  allPages = false,
) {
  const status = useAppServerStatus();

  return useQuery<v2.ProjectListResponse>({
    queryKey: allPages
      ? [...appServerQueryKeys.projects, "list", "all", params]
      : appServerQueryKeys.projectList(params),
    queryFn: async () => {
      if (!allPages) {
        const response = await requestAppServerMethod("project/list", params);
        return response.response;
      }

      const data: v2.Project[] = [];
      let cursor: string | null = null;
      do {
        const page: v2.ProjectListResponse = (
          await requestAppServerMethod("project/list", {
            ...params,
            ...(cursor === null ? {} : { cursor }),
          })
        ).response;
        data.push(...page.data);
        cursor = page.nextCursor;
      } while (cursor !== null);

      return { data, nextCursor: null };
    },
    enabled: Boolean(status.data),
  });
}

export function useAllProjectList(
  params: Omit<v2.ProjectListParams, "cursor"> = {},
) {
  return useProjectList(params, true);
}

export function useProject(projectId: string) {
  const status = useAppServerStatus();

  return useQuery<v2.ProjectReadResponse>({
    queryKey: appServerQueryKeys.project(projectId),
    queryFn: async () => {
      const response = await requestAppServerMethod("project/read", {
        projectId,
      });
      return response.response;
    },
    enabled: Boolean(status.data && projectId),
  });
}

export function projectThreadListParams(
  projectId: string,
): v2.ThreadListParams {
  return {
    projectId,
    archived: false,
    limit: 8,
    sortKey: "recency_at",
    sortDirection: "desc",
  };
}

export function useProjectThreads(
  projectId: string,
  options: Pick<
    v2.ThreadListParams,
    "searchTerm" | "sortKey" | "sortDirection"
  > = {},
) {
  return useAllThreadList(
    {
      projectId,
      archived: false,
      limit: 50,
      sortKey: options.sortKey ?? "recency_at",
      sortDirection: options.sortDirection ?? "desc",
      ...(options.searchTerm?.trim()
        ? { searchTerm: options.searchTerm.trim() }
        : {}),
    },
    Boolean(projectId),
  );
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ProjectCreateParams) => {
      const response = await requestAppServerMethod("project/create", params);
      return response.response;
    },
    onSuccess: () => invalidateProjectList(queryClient),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ProjectUpdateParams) => {
      const response = await requestAppServerMethod("project/update", params);
      return response.response;
    },
    onSuccess: (_data, params) =>
      invalidateProjectQueries(queryClient, params.projectId),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ProjectDeleteParams) => {
      const response = await requestAppServerMethod("project/delete", params);
      return response.response;
    },
    onSuccess: () => invalidateProjectList(queryClient),
  });
}
