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

type PluginMutationParams =
  | v2.MarketplaceAddParams
  | v2.MarketplaceRemoveParams
  | v2.MarketplaceUpgradeParams
  | v2.PluginInstallParams;

function usePluginMutation<TParams extends PluginMutationParams, TResponse>(
  method:
    | "marketplace/add"
    | "marketplace/remove"
    | "marketplace/upgrade"
    | "plugin/install",
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TParams) => {
      const response = await requestAppServerMethod(
        method,
        params as PluginMutationParams,
      );
      return response.response as TResponse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.plugins,
      });
    },
  });
}

export function useAddMarketplace() {
  return usePluginMutation<v2.MarketplaceAddParams, v2.MarketplaceAddResponse>(
    "marketplace/add",
  );
}

export function useUpgradeMarketplace() {
  return usePluginMutation<
    v2.MarketplaceUpgradeParams,
    v2.MarketplaceUpgradeResponse
  >("marketplace/upgrade");
}

export function useRemoveMarketplace() {
  return usePluginMutation<
    v2.MarketplaceRemoveParams,
    v2.MarketplaceRemoveResponse
  >("marketplace/remove");
}

export function useInstallPlugin() {
  return usePluginMutation<v2.PluginInstallParams, v2.PluginInstallResponse>(
    "plugin/install",
  );
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

export function useConfig(params: v2.ConfigReadParams = {}) {
  const status = useAppServerStatus();

  return useQuery<v2.ConfigReadResponse>({
    queryKey: appServerQueryKeys.config(params),
    queryFn: async () => {
      const response = await requestAppServerMethod("config/read", params);
      return response.response;
    },
    enabled: Boolean(status.data),
  });
}

export function useConfigRequirements() {
  const status = useAppServerStatus();

  return useQuery<v2.ConfigRequirementsReadResponse>({
    queryKey: appServerQueryKeys.configRequirements,
    queryFn: async () => {
      const response = await requestAppServerMethod(
        "configRequirements/read",
        undefined,
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
