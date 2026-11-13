// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerEvent } from "../events";

const { subscribeToAppServerEvents, synchronizeAppServerQueries } = vi.hoisted(
  () => ({
    subscribeToAppServerEvents: vi.fn(),
    synchronizeAppServerQueries: vi.fn(),
  }),
);

vi.mock("../event-store", () => ({
  retainThreadState: vi.fn(),
  subscribeToAppServerEvents,
  useAppServerEventStore: vi.fn(),
  useThreadActivity: vi.fn(),
}));
vi.mock("../event-query-sync", () => ({ synchronizeAppServerQueries }));
vi.mock("../runtime", () => ({ isDesktopRuntime: true }));
vi.mock("../../platform/notifications", () => ({
  createNotificationDispatcher: vi.fn(),
  sendDesktopNotification: vi.fn(),
}));
vi.mock("../../app/ui-preferences", () => ({ useUiPreferences: vi.fn() }));

function createWrapper(client: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useAppServerQuerySync", () => {
  beforeEach(() => {
    subscribeToAppServerEvents.mockReset();
    synchronizeAppServerQueries.mockReset();
  });

  it("synchronizes subscribed App Server events and unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    subscribeToAppServerEvents.mockReturnValue(unsubscribe);
    const client = new QueryClient();
    const { useAppServerQuerySync } = await import("./useAppServerEvents");
    const { unmount } = renderHook(() => useAppServerQuerySync(), {
      wrapper: createWrapper(client),
    });
    const event: AppServerEvent = {
      type: "lagged",
      data: { skipped: 2 },
    };
    const listener = subscribeToAppServerEvents.mock.calls[0]?.[0] as
      | ((event: AppServerEvent) => void)
      | undefined;

    expect(subscribeToAppServerEvents).toHaveBeenCalledOnce();
    expect(synchronizeAppServerQueries).not.toHaveBeenCalled();
    listener?.(event);
    expect(synchronizeAppServerQueries).toHaveBeenCalledWith(client, event);

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
