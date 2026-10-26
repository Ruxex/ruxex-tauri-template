import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ensureAppServer, type AppServerStatus } from "../api";
import {
  controlAppServerDaemon,
  type AppServerDaemonAction,
} from "../daemon-api";
import { appServerQueryKeys } from "../query-keys";
import { isNativeDesktopRuntime } from "../runtime";

export function useAppServerDaemon() {
  const queryClient = useQueryClient();
  const hasLocalConnection = () =>
    [
      queryClient.getQueryData<AppServerStatus>(appServerQueryKeys.connection),
      queryClient.getQueryData<AppServerStatus>(appServerQueryKeys.status),
    ].some((status) => status?.endpointKind === "local");

  const status = useQuery({
    queryKey: appServerQueryKeys.daemonStatus,
    queryFn: () => controlAppServerDaemon("version"),
    enabled: isNativeDesktopRuntime,
    retry: false,
    staleTime: 0,
  });

  const control = useMutation({
    mutationFn: (action: AppServerDaemonAction) =>
      controlAppServerDaemon(action),
    onSuccess: async (output, action) => {
      queryClient.setQueryData(appServerQueryKeys.daemonStatus, output);
      if (action === "stop") {
        if (hasLocalConnection()) {
          queryClient.setQueryData(appServerQueryKeys.connection, null);
          queryClient.setQueryData(appServerQueryKeys.status, null);
        }
        return;
      }
      if (action === "version" || !isNativeDesktopRuntime) {
        return;
      }

      const appServerStatus = await ensureAppServer();
      queryClient.setQueryData(appServerQueryKeys.connection, appServerStatus);
      queryClient.setQueryData(appServerQueryKeys.status, appServerStatus);
    },
    onError: (_error, action) => {
      if (action !== "version" && hasLocalConnection()) {
        queryClient.setQueryData(appServerQueryKeys.connection, null);
        queryClient.setQueryData(appServerQueryKeys.status, null);
      }
    },
  });

  return { status, control, isAvailable: isNativeDesktopRuntime };
}
