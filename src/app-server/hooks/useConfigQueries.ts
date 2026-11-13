import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

import { extractGlobalMcpConfig, type GlobalMcpConfig } from "../mcp-config";

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
