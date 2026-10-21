// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppServerEvent } from "./events";

const listenToAppServerEvents = vi.hoisted(() => vi.fn());
vi.mock("./events", () => ({ listenToAppServerEvents }));
vi.mock("./runtime", () => ({ isDesktopRuntime: true }));

describe("React subscription to the app-server event store", () => {
  afterEach(async () => {
    const store = await import("./event-store");
    store.stopAppServerEventStore();
    listenToAppServerEvents.mockReset();
  });

  it("publishes stream state changes to subscribed components", async () => {
    let handler: ((event: AppServerEvent) => void) | undefined;
    listenToAppServerEvents.mockImplementation(
      async (next: (event: AppServerEvent) => void) => {
        handler = next;
        return vi.fn();
      },
    );
    const store = await import("./event-store");
    const { result } = renderHook(() => store.useAppServerEventStore());

    await store.startAppServerEventStore();
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => handler?.({ type: "lagged", data: { skipped: 3 } }));

    await waitFor(() =>
      expect(result.current).toMatchObject({
        resynchronizing: true,
        skippedEvents: 3,
      }),
    );
  });

  it("resets subscribed components after a stop", async () => {
    listenToAppServerEvents.mockResolvedValue(vi.fn());
    const store = await import("./event-store");
    const { result } = renderHook(() => store.useAppServerEventStore());

    await store.startAppServerEventStore();
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => store.stopAppServerEventStore());

    expect(result.current).toMatchObject({
      connected: false,
      resynchronizing: false,
      skippedEvents: 0,
    });
  });
});
