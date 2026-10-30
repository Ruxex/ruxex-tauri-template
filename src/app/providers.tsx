import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import {
  startAppServerEventStore,
  stopAppServerEventStore,
} from "../app-server/event-store";
import {
  useAppServerNotifications,
  useAppServerQuerySync,
} from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import { pathForDeepLink, startDeepLinkListener } from "../platform/deep-links";
import { queryClient } from "./query-client";
import { UiPreferencesProvider } from "./ui-preferences";

type AppProvidersProps = {
  router: Parameters<typeof RouterProvider>[0]["router"];
};

export function AppProviders({ router }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <AppRuntime router={router} />
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

function AppRuntime({ router }: AppProvidersProps) {
  useAppServerNotifications();
  useAppServerQuerySync();

  useEffect(() => {
    void startAppServerEventStore();
    return stopAppServerEventStore;
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startDeepLinkListener((target) => {
      void router.navigate(pathForDeepLink(target));
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        stop = unlisten;
      }
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [router]);

  return <RouterProvider router={router} />;
}
