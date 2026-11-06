import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { extractGlobalMcpConfig, type GlobalMcpConfig } from "../mcp-config";
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

export function useWriteSkillConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.SkillsConfigWriteParams) => {
      const response = await requestAppServerMethod(
        "skills/config/write",
        params,
      );
      return response.response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.skills,
      });
    },
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
    ? appServerQueryKeys.mcpResource(
        params.server,
        params.uri,
        params.threadId,
      )
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

export function usePluginRead(params: v2.PluginReadParams | null) {
  const status = useAppServerStatus();

  return useQuery<v2.PluginReadResponse>({
    queryKey: [...appServerQueryKeys.plugins, "detail", params],
    queryFn: async () => {
      if (!params) {
        throw new Error("Plugin details require a local marketplace.");
      }
      const response = await requestAppServerMethod("plugin/read", params);
      return response.response;
    },
    enabled: Boolean(
      status.data && params?.marketplacePath && params.pluginName,
    ),
  });
}

type PluginMutationParams =
  | v2.MarketplaceAddParams
  | v2.MarketplaceRemoveParams
  | v2.MarketplaceUpgradeParams
  | v2.PluginInstallParams
  | v2.PluginUninstallParams;

function usePluginMutation<TParams extends PluginMutationParams, TResponse>(
  method:
    | "marketplace/add"
    | "marketplace/remove"
    | "marketplace/upgrade"
    | "plugin/install"
    | "plugin/uninstall",
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
      if (method === "plugin/uninstall") {
        void queryClient.invalidateQueries({
          queryKey: appServerQueryKeys.skills,
        });
        void queryClient.invalidateQueries({
          queryKey: appServerQueryKeys.mcpServers,
        });
      }
      if (method.startsWith("marketplace/")) {
        void queryClient.invalidateQueries({
          queryKey: appServerQueryKeys.configRoot,
        });
      }
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

export function useUninstallPlugin() {
  return usePluginMutation<
    v2.PluginUninstallParams,
    v2.PluginUninstallResponse
  >("plugin/uninstall");
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

export function useGlobalMcpConfig() {
  const status = useAppServerStatus();

  return useQuery<GlobalMcpConfig>({
    queryKey: appServerQueryKeys.globalMcpConfig,
    queryFn: async () => {
      const response = await requestAppServerMethod("config/read", {
        includeLayers: true,
      });
      return extractGlobalMcpConfig(response.response);
    },
    enabled: Boolean(status.data),
  });
}

export function useWriteConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ConfigBatchWriteParams) => {
      const response = await requestAppServerMethod(
        "config/batchWrite",
        params,
      );
      return response.response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.configRoot,
      });
      void queryClient.invalidateQueries({
        queryKey: appServerQueryKeys.mcpServers,
      });
    },
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
