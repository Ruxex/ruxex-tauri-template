import { useQuery } from "@tanstack/react-query";

import { ensureAppServerRuntime } from "./app-server-runtime";
import { appServerQueryKeys } from "./query-keys";
import { isDesktopRuntime } from "./runtime";

export function useAppServerStatus() {
  return useQuery({
    queryKey: appServerQueryKeys.status,
    queryFn: () =>
      isDesktopRuntime ? ensureAppServerRuntime() : Promise.resolve(null),
    enabled: isDesktopRuntime,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
