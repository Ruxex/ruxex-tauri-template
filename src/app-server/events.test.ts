import { describe, expect, it, vi } from "vitest";

import type { AppServerEvent } from "./events";

const listen = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/event", () => ({ listen }));

describe("listenToAppServerEvents", () => {
  it("forwards the Tauri payload and returns its unsubscribe function", async () => {
    let callback: ((event: { payload: AppServerEvent }) => void) | undefined;
    const unlisten = vi.fn();
    listen.mockImplementationOnce(async (_name, next) => {
      callback = next;
      return unlisten;
    });

    const { listenToAppServerEvents } = await import("./events");
    const received: AppServerEvent[] = [];
    const returnedUnlisten = await listenToAppServerEvents((event) => received.push(event));
    const event: AppServerEvent = { type: "lagged", data: { skipped: 4 } };
    callback?.({ payload: event });

    expect(listen).toHaveBeenCalledWith("app-server-event", expect.any(Function));
    expect(received).toEqual([event]);
    expect(returnedUnlisten).toBe(unlisten);
  });
});
