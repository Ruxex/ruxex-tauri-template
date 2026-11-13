import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

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
