import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  appServerConnectionStatus,
  connectAppServer,
  disconnectAppServer,
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
      server.invoke(command, args as never),
    );
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

  it("connects to a remote endpoint without persisting its auth token", async () => {
    const storage = { setItem: vi.fn() };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    invoke.mockResolvedValueOnce({
      socketPath: "wss://example.test/rpc",
      appServerVersion: "remote",
      endpointKind: "websocket",
    });

    await expect(
      connectAppServer({
        kind: "websocket",
        url: "wss://example.test/rpc",
        authToken: "secret-token",
      }),
    ).resolves.toMatchObject({ endpointKind: "websocket" });

    expect(invoke).toHaveBeenCalledWith("connect_app_server", {
      endpoint: {
        kind: "websocket",
        url: "wss://example.test/rpc",
        authToken: "secret-token",
      },
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("exposes disconnect and active connection status through the bridge", async () => {
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      socketPath: "local",
      appServerVersion: "local",
      endpointKind: "local",
    });

    await disconnectAppServer();
    await expect(appServerConnectionStatus()).resolves.toEqual({
      socketPath: "local",
      appServerVersion: "local",
      endpointKind: "local",
    });
    expect(invoke).toHaveBeenNthCalledWith(1, "disconnect_app_server");
    expect(invoke).toHaveBeenNthCalledWith(2, "app_server_connection_status");
  });

  it("propagates transport failures to callers", async () => {
    invoke.mockRejectedValueOnce(new Error("socket closed"));

    await expect(
      requestAppServerMethod("thread/list", { limit: 1 }),
    ).rejects.toThrow("socket closed");
  });

  it("passes an already-built protocol request through the Tauri bridge", async () => {
    const { requestAppServer } = await import("./api");
    await expect(
      requestAppServer({
        method: "thread/list",
        id: "request-1",
        params: { limit: 2 },
      }),
    ).resolves.toEqual({
      method: "thread/list",
      id: "request-1",
      response: { data: [], nextCursor: null, backwardsCursor: null },
    });
    expect(server.requests).toEqual([
      { method: "thread/list", id: "request-1", params: { limit: 2 } },
    ]);
  });

  it("rejects when the mock server has no response contract for a method", async () => {
    await expect(
      requestAppServerMethod("thread/read", { threadId: "thread-1" }),
    ).rejects.toThrow("No mock response registered for thread/read");
  });

  it("preserves string request ids for server-request responses", async () => {
    await resolveServerRequest("approval-1", { decision: "accept" });

    expect(server.resolutions).toEqual([
      { requestId: "approval-1", result: { decision: "accept" } },
    ]);
  });

  it("uses the standard JSON-RPC rejection envelope for arbitrary request ids", async () => {
    await rejectServerRequestWithMessage("approval-2", "cancelled by user");

    expect(server.rejections).toEqual([
      {
        requestId: "approval-2",
        error: { code: -32000, message: "cancelled by user" },
      },
    ]);
  });
});
