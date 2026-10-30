import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { AppServerEvent } from "./events";
import { synchronizeAppServerQueries } from "./event-query-sync";

function createQueryClient() {
  return {
    getQueriesData: vi.fn(() => []),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
  };
}

describe("app-server event query synchronization", () => {
  it("patches metadata and thread-list caches for status changes", () => {
    const queryClient = createQueryClient();
    const event: AppServerEvent = {
      type: "serverNotification",
      data: {
        method: "thread/status/changed",
        params: {
          threadId: "thread-1",
          status: { type: "idle" },
        },
      },
    };

    synchronizeAppServerQueries(queryClient as unknown as QueryClient, event);

    expect(queryClient.setQueriesData).toHaveBeenCalledTimes(3);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("invalidates only affected resources when an event lacks patch data", () => {
    const queryClient = createQueryClient();
    const event: AppServerEvent = {
      type: "serverNotification",
      data: {
        method: "thread/reverted",
        params: { threadId: "thread-1" },
      },
    };

    synchronizeAppServerQueries(queryClient as unknown as QueryClient, event);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "conversation"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "metadata"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "threads"],
    });
  });

  it("refreshes list membership for thread creation and deletion", () => {
    const queryClient = createQueryClient();
    const thread = { id: "thread-1" } as never;

    synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      {
        type: "serverNotification",
        data: { method: "thread/started", params: { thread } },
      } as AppServerEvent,
    );
    synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      {
        type: "serverNotification",
        data: { method: "thread/deleted", params: { threadId: "thread-1" } },
      } as AppServerEvent,
    );

    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "metadata"],
    });
  });

  it("does not invalidate caches for normal turn completion", () => {
    const queryClient = createQueryClient();
    synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      {
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: {
              id: "turn-1",
              status: "completed",
              items: [],
              itemsView: "full",
              error: null,
              startedAt: null,
              completedAt: null,
              durationMs: null,
            } as never,
          },
        },
      } as AppServerEvent,
    );

    expect(queryClient.setQueriesData).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
