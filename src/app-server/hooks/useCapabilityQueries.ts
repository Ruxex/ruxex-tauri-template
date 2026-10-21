import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

export function useSkillsList(params: v2.SkillsListParams = {}) {
  const status = useAppServerStatus();

  return useQuery<v2.SkillsListResponse>({
    queryKey: [...appServerQueryKeys.skills, params],
    queryFn: async () => {
      const response = await requestAppServerMethod("skills/list", params);
      return response.response;
    },
    enabled: Boolean(status.data),
  });
}

export function useMcpServerStatus(params: v2.ListMcpServerStatusParams = {}) {
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
    enabled: Boolean(status.data),
  });
}

export function usePluginList(params: v2.PluginListParams = {}) {
  const status = useAppServerStatus();

  return useQuery<v2.PluginListResponse>({
    queryKey: [...appServerQueryKeys.plugins, params],
    queryFn: async () => {
      const response = await requestAppServerMethod("plugin/list", params);
      return response.response;
    },
    enabled: Boolean(status.data),
  });
}

export function useCollaborationModes() {
  const status = useAppServerStatus();

  return useQuery<v2.CollaborationModeListResponse>({
    queryKey: appServerQueryKeys.collaborationModes,
    queryFn: async () => {
      const response = await requestAppServerMethod(
        "collaborationMode/list",
        {},
      );
      return response.response;
    },
    enabled: Boolean(status.data),
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

export function useStartReview() {
  return useMutation({
    mutationFn: async (params: v2.ReviewStartParams) => {
      const response = await requestAppServerMethod("review/start", params);
      return response.response;
    },
  });
}

export function useUpdateTurnSettings() {
  return useMutation({
    mutationFn: async (params: v2.TurnSettingsUpdateParams) => {
      const response = await requestAppServerMethod(
        "turn/settings/update",
        params,
      );
      return response.response;
    },
  });
}
