import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureAppServer,
  rejectServerRequestWithMessage,
  requestAppServerMethod,
  resolveServerRequest,
} from "./api";
import { MockAppServer } from "../test-support/mock-app-server";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

describe("requestAppServerMethod", () => {
  let server: MockAppServer;

  beforeEach(() => {
    server = new MockAppServer();
    server.respond("thread/list", {
      data: [],
      nextCursor: null,
      backwardsCursor: null,
    });
    invoke.mockReset();
    invoke.mockImplementation((command: string, args: unknown) =>
      server.invoke(command, args as never));
  });

  it("builds a typed app-server request envelope", async () => {
    await requestAppServerMethod("thread/list", { limit: 25 });

    expect(invoke).toHaveBeenCalledWith("app_server_request", {
      request: {
        method: "thread/list",
        id: 1,
        params: { limit: 25 },
      },
    });
  });

  it("uses the app-server harness for connection status and request resolution", async () => {
    await expect(ensureAppServer()).resolves.toEqual({
      socketPath: "/tmp/ruxex-test.sock",
      appServerVersion: "test-app-server",
    });

    await resolveServerRequest(42, { decision: "accept" });
    await rejectServerRequestWithMessage(43, "unsupported");

    expect(server.resolutions).toEqual([
      { requestId: 42, result: { decision: "accept" } },
    ]);
    expect(server.rejections).toEqual([
      {
        requestId: 43,
        error: { code: -32000, message: "unsupported" },
      },
    ]);
  });
});
