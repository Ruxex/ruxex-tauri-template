import { describe, expect, it } from "vitest";

import type { AppServerEvent } from "../app-server/events";
import type { v2 } from "../protocol";
import { MockAppServer } from "./mock-app-server";

describe("MockAppServer", () => {
  it("serves typed method responses and records the request", async () => {
    const server = new MockAppServer();
    server.respond("thread/list", { data: [], nextCursor: null, backwardsCursor: null });

    const response = await server.invoke("app_server_request", {
      request: { method: "thread/list", id: 7, params: { limit: 25 } },
    });

    expect(response).toEqual({
      method: "thread/list",
      id: 7,
      response: { data: [], nextCursor: null, backwardsCursor: null },
    });
    expect(server.requests).toEqual([
      { method: "thread/list", id: 7, params: { limit: 25 } },
    ]);
  });

  it("delivers protocol events and stops after unsubscribe", () => {
    const server = new MockAppServer();
    const received: AppServerEvent[] = [];
    const unsubscribe = server.onEvent((event) => received.push(event));

    server.emit({ type: "lagged", data: { skipped: 2 } });
    unsubscribe();
    server.emit({ type: "disconnected", data: { message: "closed" } });

    expect(received).toEqual([{ type: "lagged", data: { skipped: 2 } }]);
  });

  it("records server-request resolutions and rejections", async () => {
    const server = new MockAppServer();

    await server.invoke("app_server_resolve_server_request", {
      requestId: 4,
      result: { decision: "accept" },
    });
    await server.invoke("app_server_reject_server_request", {
      requestId: 5,
      error: { code: -32000, message: "declined" },
    });

    expect(server.resolutions).toEqual([
      { requestId: 4, result: { decision: "accept" } },
    ]);
    expect(server.rejections).toEqual([
      { requestId: 5, error: { code: -32000, message: "declined" } },
    ]);
  });

  it("fails loudly when a test forgets to register a response", async () => {
    const server = new MockAppServer();

    await expect(server.invoke("app_server_request", {
      request: { method: "model/list", id: 1, params: {} },
    })).rejects.toThrow("No mock response registered for model/list");
  });

  it("supports a typed model response fixture", async () => {
    const server = new MockAppServer();
    const model: v2.Model = {
      id: "model-1",
      model: "test-model",
      displayName: "Test model",
      description: "",
      upgrade: null,
      upgradeInfo: null,
      availabilityNux: null,
      modelSpecialty: null,
      hidden: false,
      supportedReasoningEfforts: [],
      defaultReasoningEffort: "",
      inputModalities: ["text"],
      multiAgentVersion: null,
      additionalSpeedTiers: [],
      serviceTiers: [],
      defaultServiceTier: null,
      availableAccessPrograms: null,
      isDefault: true,
    };
    server.respond("model/list", { data: [model], nextCursor: null });

    const result = await server.invoke("app_server_request", {
      request: { method: "model/list", id: 2, params: {} },
    });

    expect(result).toMatchObject({ response: { data: [model] } });
  });
});
