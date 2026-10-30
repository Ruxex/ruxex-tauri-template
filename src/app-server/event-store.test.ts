import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerEvent } from "./events";

const listenToAppServerEvents = vi.hoisted(() => vi.fn());

vi.mock("./events", () => ({ listenToAppServerEvents }));
vi.mock("./runtime", () => ({ isDesktopRuntime: true }));

describe("app-server event store", () => {
  beforeEach(async () => {
    listenToAppServerEvents.mockReset();
    const store = await import("./event-store");
    store.stopAppServerEventStore();
  });

  it("exposes reducer state and marks a lagged stream for resynchronization", async () => {
    let handler: ((event: AppServerEvent) => void) | undefined;
    listenToAppServerEvents.mockImplementation(
      async (next: (event: AppServerEvent) => void) => {
        handler = next;
        return () => undefined;
      },
    );

    const store = await import("./event-store");
    await store.startAppServerEventStore();
    handler?.({ type: "lagged", data: { skipped: 2 } });

    expect(store.getAppServerEventSnapshot()).toMatchObject({
      connected: true,
      resynchronizing: true,
      skippedEvents: 2,
    });
  });

  it("does not leak a listener when StrictMode restarts before listen resolves", async () => {
    let resolveFirst: ((unlisten: () => void) => void) | undefined;
    let resolveSecond: ((unlisten: () => void) => void) | undefined;
    const firstUnlisten = vi.fn();
    const secondUnlisten = vi.fn();
    listenToAppServerEvents
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const store = await import("./event-store");
    const firstStart = store.startAppServerEventStore();
    store.stopAppServerEventStore();
    const secondStart = store.startAppServerEventStore();

    resolveFirst?.(firstUnlisten);
    await firstStart;
    expect(firstUnlisten).toHaveBeenCalledTimes(1);

    resolveSecond?.(secondUnlisten);
    await secondStart;
    store.stopAppServerEventStore();
    expect(secondUnlisten).toHaveBeenCalledTimes(1);
  });

  it("ignores events from a replaced connection listener", async () => {
    const handlers: Array<(event: AppServerEvent) => void> = [];
    listenToAppServerEvents.mockImplementation(
      async (next: (event: AppServerEvent) => void) => {
        handlers.push(next);
        return vi.fn();
      },
    );

    const store = await import("./event-store");
    await store.startAppServerEventStore();
    store.stopAppServerEventStore();
    await store.startAppServerEventStore();

    handlers[0]?.({ type: "lagged", data: { skipped: 99 } });
    handlers[1]?.({ type: "lagged", data: { skipped: 2 } });

    expect(store.getAppServerEventSnapshot()).toMatchObject({
      connected: true,
      resynchronizing: true,
      skippedEvents: 2,
    });
  });

  it("ignores events from a listener after the store has stopped", async () => {
    let handler: ((event: AppServerEvent) => void) | undefined;
    const unlisten = vi.fn();
    listenToAppServerEvents.mockImplementationOnce(
      async (next: (event: AppServerEvent) => void) => {
        handler = next;
        return unlisten;
      },
    );

    const store = await import("./event-store");
    await store.startAppServerEventStore();
    store.stopAppServerEventStore();

    handler?.({ type: "lagged", data: { skipped: 99 } });

    expect(store.getAppServerEventSnapshot()).toMatchObject({
      connected: false,
      resynchronizing: false,
      skippedEvents: 0,
    });
  });

  it("allows a failed listener setup to be retried", async () => {
    listenToAppServerEvents
      .mockRejectedValueOnce(new Error("listener unavailable"))
      .mockResolvedValueOnce(vi.fn());

    const store = await import("./event-store");
    await expect(store.startAppServerEventStore()).rejects.toThrow(
      "listener unavailable",
    );
    await expect(store.startAppServerEventStore()).resolves.toBeUndefined();
    expect(store.getAppServerEventSnapshot().connected).toBe(true);
  });

  it("retains the visible thread while pruning idle renderer state", async () => {
    vi.useFakeTimers();
    try {
      let handler: ((event: AppServerEvent) => void) | undefined;
      listenToAppServerEvents.mockImplementation(
        async (next: (event: AppServerEvent) => void) => {
          handler = next;
          return vi.fn();
        },
      );

      const store = await import("./event-store");
      await store.startAppServerEventStore();
      const release = store.retainThreadState("visible");
      handler?.({
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: {
            threadId: "idle",
            turn: {
              id: "idle-turn",
              status: "completed",
              items: [],
            } as never,
          },
        },
      });
      handler?.({
        type: "serverNotification",
        data: {
          method: "turn/completed",
          params: {
            threadId: "visible",
            turn: {
              id: "visible-turn",
              status: "completed",
              items: [],
            } as never,
          },
        },
      });

      vi.advanceTimersByTime(10 * 60_000 + 1);

      expect(store.getAppServerEventSnapshot().threads).not.toHaveProperty(
        "idle",
      );
      expect(store.getAppServerEventSnapshot().threads).toHaveProperty(
        "visible",
      );
      release();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears recovered live items without losing active thread metadata", async () => {
    let handler: ((event: AppServerEvent) => void) | undefined;
    listenToAppServerEvents.mockImplementation(
      async (next: (event: AppServerEvent) => void) => {
        handler = next;
        return vi.fn();
      },
    );

    const store = await import("./event-store");
    await store.startAppServerEventStore();
    handler?.({
      type: "serverNotification",
      data: {
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "inProgress" } as never,
        },
      },
    });
    handler?.({
      type: "serverNotification",
      data: {
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "stale",
        },
      },
    });

    const staleItem =
      store.getAppServerEventSnapshot().threads["thread-1"]?.items[0];
    handler?.({
      type: "serverNotification",
      data: {
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "fresh",
        },
      },
    });
    store.clearThreadLiveItems(
      "thread-1",
      new Set(staleItem ? [staleItem] : []),
    );

    expect(store.getAppServerEventSnapshot().threads["thread-1"]).toMatchObject(
      {
        activeTurnId: "turn-1",
        status: "running",
        items: [{ id: "item-1", text: "stalefresh" }],
      },
    );
  });

  it("notifies event subscribers once for each new event", async () => {
    let handler: ((event: AppServerEvent) => void) | undefined;
    listenToAppServerEvents.mockImplementation(
      async (next: (event: AppServerEvent) => void) => {
        handler = next;
        return vi.fn();
      },
    );
    const listener = vi.fn();

    const store = await import("./event-store");
    const unsubscribe = store.subscribeToAppServerEvents(listener);
    await store.startAppServerEventStore();
    const event: AppServerEvent = {
      type: "lagged",
      data: { skipped: 1 },
    };
    const secondEvent: AppServerEvent = {
      type: "lagged",
      data: { skipped: 2 },
    };
    handler?.(event);
    handler?.(secondEvent);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(event);
    expect(listener).toHaveBeenCalledWith(secondEvent);
    unsubscribe();
  });
});
