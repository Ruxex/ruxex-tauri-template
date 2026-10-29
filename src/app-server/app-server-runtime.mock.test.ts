import { describe, expect, it, vi } from "vitest";

const ensureAppServer = vi.hoisted(() => vi.fn());
const startAppServerEventStore = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ ensureAppServer }));
vi.mock("./event-store", () => ({ startAppServerEventStore }));
vi.mock("./runtime", () => ({ isMockAppServerRuntime: true }));

import { ensureAppServerRuntime } from "./app-server-runtime";

describe("ensureAppServerRuntime in the mock runtime", () => {
  it("does not start the native event store", async () => {
    ensureAppServer.mockResolvedValue({
      socketPath: "/tmp/ruxex-test.sock",
      appServerVersion: "test-app-server",
    });

    await ensureAppServerRuntime();

    expect(startAppServerEventStore).not.toHaveBeenCalled();
    expect(ensureAppServer).toHaveBeenCalledOnce();
  });
});
