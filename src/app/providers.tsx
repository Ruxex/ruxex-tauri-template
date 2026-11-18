import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { RouterProvider } from "react-router-dom";

import { startAppServerEventStore, stopAppServerEventStore } from "@/app-server/event-store";
import { useAppServerNotifications, useAppServerQuerySync } from "@/app-server/hooks";
import { isDesktopRuntime } from "@/app-server/runtime";
import { pathForDeepLink, startDeepLinkListener } from "@/platform/deep-links";
import { BrandingProvider } from "./branding";
import { i18n } from "./i18n";
import { queryClient } from "./query-client";
import { ThreadReadStateProvider } from "./thread-read-state";
import { UiPreferencesProvider } from "./ui-preferences";

type AppProvidersProps = {
  router: Parameters<typeof RouterProvider>[0]["router"];
};

export function AppProviders({ router }: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <ThreadReadStateProvider>
            <UiPreferencesProvider>
              <AppRuntime router={router} />
            </UiPreferencesProvider>
          </ThreadReadStateProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function AppRuntime({ router }: AppProvidersProps) {
  useAppServerNotifications((threadId) => {
    void router.navigate(`/chat/${encodeURIComponent(threadId)}`);
  });
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
