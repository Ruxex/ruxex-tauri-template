import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { AppServerStatus } from "../api";
import { ensureAppServerRuntime } from "../app-server-runtime";
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
    queryFn: ensureAppServerRuntime,
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
        queryClient.setQueryData(appServerQueryKeys.status, null);
        return;
      }
      if (
        action === "version" ||
        !isNativeDesktopRuntime ||
        mode === "inprocess"
      ) {
        return;
      }

      const connectedStatus = await ensureAppServerRuntime();
      queryClient.setQueryData(appServerQueryKeys.status, connectedStatus);
    },
    onError: (_error, action) => {
      if (action !== "version") {
        queryClient.setQueryData(appServerQueryKeys.status, null);
      }
    },
  });

  return {
    status,
    control,
    isAvailable: isNativeDesktopRuntime && mode !== "inprocess",
    mode,
    appServerError: appServerStatus.error,
    appServerReady: !isNativeDesktopRuntime || appServerStatus.isSuccess,
  };
}
