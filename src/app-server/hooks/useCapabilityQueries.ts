import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { extractGlobalMcpConfig, type GlobalMcpConfig } from "../mcp-config";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

export function useSkillsList(
  params: v2.SkillsListParams = {},
  enabled = true,
) {
  const status = useAppServerStatus();

  return useQuery<v2.SkillsListResponse>({
    queryKey: [...appServerQueryKeys.skills, params],
    queryFn: async () => {
      const response = await requestAppServerMethod("skills/list", params);
      return response.response;
    },
    enabled: Boolean(status.data && enabled),
  });
}

export function useHooksList(params: v2.HooksListParams = {}) {
  const status = useAppServerStatus();

  return useQuery<v2.HooksListResponse>({
    queryKey: [...appServerQueryKeys.hooks, params],
    queryFn: async () => {
      const response = await requestAppServerMethod("hooks/list", params);
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

export function useSetSkillsExtraRoots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.SkillsExtraRootsSetParams) => {
      const response = await requestAppServerMethod(
        "skills/extraRoots/set",
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

export function usePluginList(
  params: v2.PluginListParams = {},
  enabled = true,
) {
  const status = useAppServerStatus();

  return useQuery<v2.PluginListResponse>({
    queryKey: [...appServerQueryKeys.plugins, params],
    queryFn: async () => {
      const response = await requestAppServerMethod("plugin/list", params);
      return response.response;
    },
    enabled: Boolean(status.data && enabled),
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

function usePluginMutation<TParams, TResponse>(
  mutationFn: (params: TParams) => Promise<TResponse>,
  invalidates: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of invalidates) {
        void queryClient.invalidateQueries({
          queryKey,
        });
      }
    },
  });
}

export function useAddMarketplace() {
  return usePluginMutation(
    async (params: v2.MarketplaceAddParams) =>
      (await requestAppServerMethod("marketplace/add", params)).response,
    [appServerQueryKeys.plugins, appServerQueryKeys.configRoot],
  );
}

export function useUpgradeMarketplace() {
  return usePluginMutation(
    async (params: v2.MarketplaceUpgradeParams) =>
      (await requestAppServerMethod("marketplace/upgrade", params)).response,
    [appServerQueryKeys.plugins, appServerQueryKeys.configRoot],
  );
}

export function useRemoveMarketplace() {
  return usePluginMutation(
    async (params: v2.MarketplaceRemoveParams) =>
      (await requestAppServerMethod("marketplace/remove", params)).response,
    [appServerQueryKeys.plugins, appServerQueryKeys.configRoot],
  );
}

export function useInstallPlugin() {
  return usePluginMutation(
    async (params: v2.PluginInstallParams) =>
      (await requestAppServerMethod("plugin/install", params)).response,
    [appServerQueryKeys.plugins],
  );
}

export function useUninstallPlugin() {
  return usePluginMutation(
    async (params: v2.PluginUninstallParams) =>
      (await requestAppServerMethod("plugin/uninstall", params)).response,
    [
      appServerQueryKeys.plugins,
      appServerQueryKeys.skills,
      appServerQueryKeys.mcpServers,
    ],
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
