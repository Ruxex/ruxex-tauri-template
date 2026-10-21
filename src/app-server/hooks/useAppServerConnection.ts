import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  appServerConnectionStatus,
  connectAppServer,
  disconnectAppServer,
} from "../api";
import type { AppServerEndpoint } from "../api";
import { appServerQueryKeys } from "../query-keys";
import { isDesktopRuntime } from "../runtime";

export function useAppServerConnection() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: appServerQueryKeys.connection,
    queryFn: () =>
      isDesktopRuntime ? appServerConnectionStatus() : Promise.resolve(null),
    enabled: isDesktopRuntime,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const connect = useMutation({
    mutationFn: (endpoint: AppServerEndpoint) => connectAppServer(endpoint),
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(appServerQueryKeys.connection, nextStatus);
      queryClient.setQueryData(appServerQueryKeys.status, nextStatus);
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectAppServer,
    onSuccess: () => {
      queryClient.setQueryData(appServerQueryKeys.connection, null);
      queryClient.setQueryData(appServerQueryKeys.status, null);
    },
  });

  return { status, connect, disconnect };
}
