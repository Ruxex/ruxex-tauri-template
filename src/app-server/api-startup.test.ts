import { beforeEach, describe, expect, it, vi } from "vitest";

const callOrder: string[] = [];
const invoke = vi.hoisted(() => vi.fn());
const startAppServerEventStore = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./event-store", () => ({ startAppServerEventStore }));
vi.mock("./runtime", () => ({
  isDesktopRuntime: true,
  isMockAppServerRuntime: false,
}));

import { ensureAppServer } from "./api";

describe("ensureAppServer startup ordering", () => {
  beforeEach(() => {
    callOrder.length = 0;
    startAppServerEventStore.mockImplementation(async () => {
      callOrder.push("events");
    });
    invoke.mockImplementation(async () => {
      callOrder.push("ensure");
      return {
        socketPath: "/tmp/ruxex-test.sock",
        appServerVersion: "test-app-server",
      };
    });
  });

  it("starts the event listener before opening the app-server connection", async () => {
    await expect(ensureAppServer()).resolves.toEqual({
      socketPath: "/tmp/ruxex-test.sock",
      appServerVersion: "test-app-server",
    });

    expect(callOrder).toEqual(["events", "ensure"]);
  });
});
