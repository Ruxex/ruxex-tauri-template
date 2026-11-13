import { useMutation, useQuery } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import { useAppServerStatus } from "../queries";
import { appServerQueryKeys } from "../query-keys";

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
