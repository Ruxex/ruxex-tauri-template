import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
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
