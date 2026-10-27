import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ensureAppServer, type AppServerStatus } from "../api";
import {
  controlAppServerDaemon,
  type AppServerDaemonAction,
} from "../daemon-api";
import { appServerQueryKeys } from "../query-keys";
import { isNativeDesktopRuntime } from "../runtime";

export function useAppServerDaemon() {
  const queryClient = useQueryClient();
  const [lastMode, setLastMode] = useState<AppServerStatus["mode"]>();
  const appServerStatus = useQuery({
    queryKey: appServerQueryKeys.status,
    queryFn: ensureAppServer,
    enabled: isNativeDesktopRuntime,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  useEffect(() => {
    if (appServerStatus.data) {
      setLastMode(appServerStatus.data.mode);
    }
  }, [appServerStatus.data]);
  const mode = appServerStatus.data?.mode ?? lastMode;
  const hasLocalConnection = () =>
    [
      queryClient.getQueryData<AppServerStatus>(appServerQueryKeys.connection),
      queryClient.getQueryData<AppServerStatus>(appServerQueryKeys.status),
    ].some((status) => status?.endpointKind === "local");

  const status = useQuery({
    queryKey: appServerQueryKeys.daemonStatus,
    queryFn: () => controlAppServerDaemon("version"),
    enabled:
      isNativeDesktopRuntime &&
      appServerStatus.isSuccess &&
      mode !== "inprocess",
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
      if (
        action === "version" ||
        !isNativeDesktopRuntime ||
        mode === "inprocess"
      ) {
        return;
      }

      const connectedStatus = await ensureAppServer();
      queryClient.setQueryData(appServerQueryKeys.connection, connectedStatus);
      queryClient.setQueryData(appServerQueryKeys.status, connectedStatus);
    },
    onError: (_error, action) => {
      if (action !== "version" && hasLocalConnection()) {
        queryClient.setQueryData(appServerQueryKeys.connection, null);
        queryClient.setQueryData(appServerQueryKeys.status, null);
      }
    },
  });

  return {
    status,
    control,
    isAvailable:
      isNativeDesktopRuntime &&
      appServerStatus.isSuccess &&
      appServerStatus.error == null &&
      mode !== "inprocess",
    mode,
    appServerError: appServerStatus.error,
    appServerReady: !isNativeDesktopRuntime || appServerStatus.isSuccess,
  };
}
