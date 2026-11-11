import type { QueryClient } from "@tanstack/react-query";
import { QueryClient as RealQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestAppServerMethod = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ requestAppServerMethod }));

import { synchronizeAppServerQueries } from "./event-query-sync";
import type { AppServerEvent } from "./events";
import { appServerQueryKeys } from "./query-keys";

function createQueryClient() {
  return {
    getQueriesData: vi.fn(() => []),
    cancelQueries: vi.fn(() => Promise.resolve()),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
  };
}

describe("app-server event query synchronization", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
  });

  it("updates the thread goal cache from goal update notifications", () => {
    const queryClient = createQueryClient();
    const goal = {
      threadId: "thread-1",
      objective: "Ship the redesign",
      status: "active",
      tokenBudget: null,
      tokensUsed: 0,
      timeUsedSeconds: 0,
      createdAt: 0,
      updatedAt: 0,
    } as never;
    const event = {
      type: "serverNotification",
      data: {
        method: "thread/goal/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          goal,
        },
      },
    } as AppServerEvent;

    synchronizeAppServerQueries(queryClient as unknown as QueryClient, event);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      appServerQueryKeys.threadGoal("thread-1"),
      { goal },
    );
  });

  it("clears the thread goal cache from goal cleared notifications", () => {
    const queryClient = createQueryClient();
    const event: AppServerEvent = {
      type: "serverNotification",
      data: {
        method: "thread/goal/cleared",
        params: { threadId: "thread-1" },
      },
    };

    synchronizeAppServerQueries(queryClient as unknown as QueryClient, event);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      appServerQueryKeys.threadGoal("thread-1"),
      { goal: null },
    );
  });

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

  it("does not invalidate conversation caches for normal turn completion", async () => {
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "message",
          updatedAt: 1,
          recencyAt: 1,
        },
      },
    });
    const queryClient = createQueryClient();
    await synchronizeAppServerQueries(
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

    expect(queryClient.setQueriesData).toHaveBeenCalledTimes(3);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("updates preview caches after a completed turn without replacing a name", async () => {
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: "Stale name",
          preview: "The first message",
          updatedAt: 20,
          recencyAt: 20,
        },
      },
    });
    const queryClient = createQueryClient();

    await synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      {
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: { threadId: "thread-1", turn: {} as never },
        },
      } as AppServerEvent,
    );

    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
    });
    expect(queryClient.setQueriesData).toHaveBeenCalledTimes(3);

    const metadataCall = queryClient.setQueriesData.mock.calls.find(
      ([options]) =>
        JSON.stringify(options) ===
        JSON.stringify({
          queryKey: ["app-server", "thread", "thread-1", "metadata"],
        }),
    );
    expect(metadataCall).toBeDefined();
    expect(
      metadataCall?.[1]({
        thread: {
          id: "thread-1",
          name: "Pinned name",
          preview: "old",
          updatedAt: 10,
        },
      }),
    ).toEqual({
      thread: {
        id: "thread-1",
        name: "Pinned name",
        preview: "The first message",
        updatedAt: 20,
        recencyAt: 20,
      },
    });
  });

  it("does not apply an older preview response over newer cache data", async () => {
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "older message",
          updatedAt: 10,
          recencyAt: 10,
        },
      },
    });
    const queryClient = createQueryClient();

    await synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      {
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: { threadId: "thread-1", turn: {} as never },
        },
      } as AppServerEvent,
    );

    const metadataCall = queryClient.setQueriesData.mock.calls.find(
      ([options]) =>
        JSON.stringify(options) ===
        JSON.stringify({
          queryKey: ["app-server", "thread", "thread-1", "metadata"],
        }),
    );
    expect(
      metadataCall?.[1]({
        thread: {
          id: "thread-1",
          name: null,
          preview: "newer message",
          updatedAt: 20,
        },
      }),
    ).toEqual({
      thread: {
        id: "thread-1",
        name: null,
        preview: "newer message",
        updatedAt: 20,
      },
    });
  });

  it("deduplicates concurrent preview refreshes for one thread", async () => {
    let resolveResponse: ((value: unknown) => void) | undefined;
    requestAppServerMethod.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const queryClient = createQueryClient();
    const event = {
      type: "serverNotification",
      data: {
        method: "turn/completed",
        params: { threadId: "thread-1", turn: {} as never },
      },
    } as AppServerEvent;

    const first = synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      event,
    );
    const second = synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      event,
    );

    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
    resolveResponse?.({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "message",
          updatedAt: 1,
          recencyAt: 1,
        },
      },
    });
    await Promise.all([first, second]);
  });

  it("refreshes again when a different turn completes during a refresh", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    requestAppServerMethod.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "latest message",
          updatedAt: 2,
          recencyAt: 2,
        },
      },
    });
    const queryClient = createQueryClient();
    const eventForTurn = (turnId: string) =>
      ({
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: { threadId: "thread-1", turn: { id: turnId } as never },
        },
      }) as AppServerEvent;

    const first = synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      eventForTurn("turn-1"),
    );
    const second = synchronizeAppServerQueries(
      queryClient as unknown as QueryClient,
      eventForTurn("turn-2"),
    );

    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
    resolveFirst?.({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "first message",
          updatedAt: 1,
          recencyAt: 1,
        },
      },
    });
    await Promise.all([first, second]);

    expect(requestAppServerMethod).toHaveBeenCalledTimes(2);
    expect(requestAppServerMethod).toHaveBeenLastCalledWith("thread/read", {
      threadId: "thread-1",
    });
  });

  it("prevents an older metadata query from regressing a refreshed preview", async () => {
    let resolveOldQuery: ((value: unknown) => void) | undefined;
    const queryClient = new RealQueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const metadataKey = [
      ...appServerQueryKeys.threadMetadata("thread-1"),
      { includeTurns: false },
    ];
    queryClient.setQueryData(metadataKey, {
      thread: {
        id: "thread-1",
        name: null,
        preview: "initial preview",
        updatedAt: 5,
        recencyAt: 5,
      },
    });
    const oldQuery = queryClient.fetchQuery({
      queryKey: metadataKey,
      queryFn: () =>
        new Promise((resolve) => {
          resolveOldQuery = resolve;
        }),
    });
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "new preview",
          updatedAt: 30,
          recencyAt: 30,
        },
      },
    });

    const refresh = synchronizeAppServerQueries(queryClient, {
      type: "serverNotification",
      data: {
        method: "turn/completed",
        params: { threadId: "thread-1", turn: { id: "turn-1" } as never },
      },
    } as AppServerEvent);
    await refresh;

    resolveOldQuery?.({
      thread: {
        id: "thread-1",
        name: null,
        preview: "old preview",
        updatedAt: 10,
        recencyAt: 10,
      },
    });
    await oldQuery.catch(() => undefined);

    expect(queryClient.getQueryData(metadataKey)).toMatchObject({
      thread: { preview: "new preview", updatedAt: 30 },
    });
  });

  it("restores metadata canceled before its first response", async () => {
    let resolveMetadata: ((value: unknown) => void) | undefined;
    const queryClient = new RealQueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const metadataKey = [
      ...appServerQueryKeys.threadMetadata("thread-1"),
      { includeTurns: false },
    ];
    const metadataQuery = queryClient
      .fetchQuery({
        queryKey: metadataKey,
        queryFn: () =>
          new Promise((resolve) => {
            resolveMetadata = resolve;
          }),
      })
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));

    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        thread: {
          id: "thread-1",
          name: null,
          preview: "new preview",
          updatedAt: 30,
          recencyAt: 30,
        },
      },
    });

    await synchronizeAppServerQueries(queryClient, {
      type: "serverNotification",
      data: {
        method: "turn/completed",
        params: { threadId: "thread-1", turn: { id: "turn-1" } as never },
      },
    } as AppServerEvent);
    resolveMetadata?.({
      thread: {
        id: "thread-1",
        name: null,
        preview: "old preview",
        updatedAt: 10,
      },
    });
    await metadataQuery;

    expect(queryClient.getQueryData(metadataKey)).toMatchObject({
      thread: { preview: "new preview", updatedAt: 30 },
    });
    expect(queryClient.getQueryState(metadataKey)?.fetchStatus).toBe("idle");
  });
});
