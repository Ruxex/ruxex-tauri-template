import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "@/protocol";
import { requestAppServerMethod } from "@/app-server/api";
import { useAppServerStatus } from "@/app-server/queries";
import { appServerQueryKeys } from "@/app-server/query-keys";

import { extractGlobalMcpConfig, type GlobalMcpConfig } from "@/app-server/mcp-config";

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
  // Select from raw cached configuration again when the UI language changes.
  useTranslation("mcp");
  const status = useAppServerStatus();

  return useQuery<v2.ConfigReadResponse, Error, GlobalMcpConfig>({
    queryKey: appServerQueryKeys.globalMcpConfig,
    select: (response) => extractGlobalMcpConfig(response),
    queryFn: async () => {
      const response = await requestAppServerMethod("config/read", {
        includeLayers: true,
      });
      return response.response;
    },
    enabled: Boolean(status.data),
  });
}

export function useWriteConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ConfigBatchWriteParams) => {
      const response = await requestAppServerMethod("config/batchWrite", params);
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
      const response = await requestAppServerMethod("configRequirements/read", undefined);
      return response.response;
    },
    enabled: Boolean(status.data),
  });
}
