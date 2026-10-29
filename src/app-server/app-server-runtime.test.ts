import { beforeEach, describe, expect, it, vi } from "vitest";

const callOrder: string[] = [];
const ensureAppServer = vi.hoisted(() => vi.fn());
const startAppServerEventStore = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ ensureAppServer }));
vi.mock("./event-store", () => ({ startAppServerEventStore }));
vi.mock("./runtime", () => ({ isMockAppServerRuntime: false }));

import { ensureAppServerRuntime } from "./app-server-runtime";

describe("ensureAppServerRuntime", () => {
  beforeEach(() => {
    callOrder.length = 0;
    startAppServerEventStore.mockImplementation(async () => {
      callOrder.push("events");
    });
    ensureAppServer.mockImplementation(async () => {
      callOrder.push("ensure");
      return {
        socketPath: "/tmp/ruxex-test.sock",
        appServerVersion: "test-app-server",
      };
    });
  });

  it("starts event capture before connecting the native app-server", async () => {
    await expect(ensureAppServerRuntime()).resolves.toMatchObject({
      appServerVersion: "test-app-server",
    });

    expect(callOrder).toEqual(["events", "ensure"]);
  });
});
