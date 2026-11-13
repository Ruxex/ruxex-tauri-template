import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

export function useMcpServerStatus(
  params: v2.ListMcpServerStatusParams = {},
  enabled = true,
) {
  const status = useAppServerStatus();

  return useQuery<v2.ListMcpServerStatusResponse>({
    queryKey: [...appServerQueryKeys.mcpServers, params],
    queryFn: async () => {
      const response = await requestAppServerMethod(
        "mcpServerStatus/list",
        params,
      );
      return response.response;
    },
    enabled: Boolean(status.data && enabled),
  });
}

export function useAllMcpServerStatus() {
  const status = useAppServerStatus();

  return useQuery<v2.ListMcpServerStatusResponse>({
    queryKey: [...appServerQueryKeys.mcpServers, "all"],
    queryFn: async () => {
      const data: v2.McpServerStatus[] = [];
      let cursor: string | null = null;

      do {
        const params: v2.ListMcpServerStatusParams = { detail: "full" };
        if (cursor !== null) {
          params.cursor = cursor;
        }
        const response = await requestAppServerMethod(
          "mcpServerStatus/list",
          params,
        );
        data.push(...response.response.data);
        cursor = response.response.nextCursor;
      } while (cursor !== null);

      return { data, nextCursor: null };
    },
    enabled: Boolean(status.data),
  });
}

export function useMcpResource(params: v2.McpResourceReadParams | null) {
  const status = useAppServerStatus();
  const queryKey = params
    ? appServerQueryKeys.mcpResource(params.server, params.uri, params.threadId)
    : appServerQueryKeys.mcpResource("", "");

  return useQuery<v2.McpResourceReadResponse>({
    queryKey,
    queryFn: async () => {
      if (!params) {
        throw new Error("MCP Resource selection is required.");
      }
      const requestParams: v2.McpResourceReadParams = {
        server: params.server,
        uri: params.uri,
      };
      if (params.threadId) {
        requestParams.threadId = params.threadId;
      }
      const response = await requestAppServerMethod(
        "mcpServer/resource/read",
        requestParams,
      );
      return response.response;
    },
    enabled: Boolean(status.data && params?.server && params.uri),
  });
}

export function useCallMcpTool() {
  return useMutation({
    mutationFn: async (params: v2.McpServerToolCallParams) => {
      const response = await requestAppServerMethod(
        "mcpServer/tool/call",
        params,
      );
      return response.response;
    },
  });
}

export function useReloadMcpServers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: v2.McpServerRefreshParams) => {
      const response = await requestAppServerMethod(
        "config/mcpServer/reload",
        params,
      );
      return response.response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.mcpServers,
      });
    },
  });
}

export function useMcpOauthLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.McpServerOauthLoginParams) => {
      const response = await requestAppServerMethod(
        "mcpServer/oauth/login",
        params,
      );
      return response.response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.mcpServers,
      });
    },
  });
}
