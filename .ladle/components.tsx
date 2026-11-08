import type { GlobalProvider } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { ThreadReadStateProvider } from "../src/app/thread-read-state";
import { UiPreferencesProvider } from "../src/app/ui-preferences";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export const Provider: GlobalProvider = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ThreadReadStateProvider>
      <UiPreferencesProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </UiPreferencesProvider>
    </ThreadReadStateProvider>
  </QueryClientProvider>
);
