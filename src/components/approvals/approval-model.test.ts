import { describe, expect, it } from "vitest";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import type { ServerRequest } from "../../protocol";
import type { v2 } from "../../protocol";
import {
  buildApprovalResponse,
  buildApprovalScope,
  buildMcpElicitationResponse,
  buildUserInputResponse,
  buildPermissionsApprovalResponse,
  canResolvePendingRequest,
  isPermissionsApproval,
  isRequestActionable,
} from "./approval-model";

function request(
  method: string,
  params: unknown = {},
  id: string | number = 1,
): ServerRequest {
  return { method, params, id } as ServerRequest;
}

describe("approval model", () => {
  const permissions = {
    network: { enabled: true },
    fileSystem: {
      read: ["/workspace/read"],
      write: ["/workspace/write"],
      globScanMaxDepth: 3,
    },
  } satisfies v2.RequestPermissionProfile;

  const permissionsRequest = request("item/permissions/requestApproval", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-1",
    environmentId: null,
    startedAtMs: 123,
    cwd: "/workspace",
    reason: "Need to inspect the project",
    permissions,
  });

  it("identifies permission approval requests", () => {
    expect(isPermissionsApproval(permissionsRequest)).toBe(true);
    expect(
      isPermissionsApproval(request("item/commandExecution/requestApproval")),
    ).toBe(false);
  });

  it.each(["turn", "session"] as const)(
    "builds an allowed permission response for %s scope",
    (scope) => {
      expect(
        buildPermissionsApprovalResponse(
          permissionsRequest,
          "accept",
          scope,
        ),
      ).toEqual({ permissions, scope });
    },
  );

  it("builds a denied permission response without granting permissions", () => {
    expect(
      buildPermissionsApprovalResponse(permissionsRequest, "decline", "session"),
    ).toEqual({ permissions: {}, scope: "turn" });
  });

  it("does not build permission responses for unrelated requests", () => {
    expect(
      buildPermissionsApprovalResponse(
        request("item/commandExecution/requestApproval"),
        "accept",
        "turn",
      ),
    ).toBeNull();
  });

  it("keeps only non-empty string approval scope fields", () => {
    expect(
      buildApprovalScope(
        request("item/commandExecution/requestApproval", {
          command: "pnpm test",
          cwd: "/workspace",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          empty: "ignored",
          numeric: 42,
        }),
      ),
    ).toEqual({
      command: "pnpm test",
      cwd: "/workspace",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
    });
  });

  it("builds approval responses for command and file-change requests", () => {
    for (const method of [
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
    ]) {
      expect(
        buildApprovalResponse(request(method), "acceptForSession"),
      ).toEqual({
        decision: "acceptForSession",
      });
    }
  });

  it("does not turn unrelated server requests into approval responses", () => {
    expect(
      buildApprovalResponse(request("item/tool/requestUserInput"), "accept"),
    ).toBeNull();
  });

  it("builds MCP elicitation responses only for MCP elicitation requests", () => {
    const elicitation = request("mcpServer/elicitation/request");

    expect(buildMcpElicitationResponse(elicitation, "accept")).toEqual({
      action: "accept",
      content: null,
      _meta: null,
    });
    expect(buildMcpElicitationResponse(elicitation, "cancel")).toEqual({
      action: "cancel",
      content: null,
      _meta: null,
    });
    expect(
      buildMcpElicitationResponse(
        request("item/commandExecution/requestApproval"),
        "accept",
      ),
    ).toBeNull();
  });

  it("builds user-input responses only for user-input requests", () => {
    const answers = { folder: { answers: ["/workspace"] } };
    expect(
      buildUserInputResponse(request("item/tool/requestUserInput"), answers),
    ).toEqual({ answers });
    expect(
      buildUserInputResponse(request("mcpServer/elicitation/request"), answers),
    ).toBeNull();
  });

  it.each([
    [null, false],
    [{}, false],
    [{ method: "item/tool/requestUserInput", id: true, params: {} }, false],
    [{ method: "item/tool/requestUserInput", id: 1 }, false],
    [{ method: "item/tool/requestUserInput", id: 1, params: {} }, true],
  ])("validates actionable request payloads: %o", (value, expected) => {
    expect(isRequestActionable(value)).toBe(expected);
  });

  it("requires both a valid request and a live connection before resolving", () => {
    const pending: PendingServerRequest = {
      requestId: 1,
      kind: "userInput",
      request: request("item/tool/requestUserInput"),
      threadId: null,
      turnId: null,
      itemId: null,
    };

    expect(canResolvePendingRequest(pending, true)).toBe(true);
    expect(canResolvePendingRequest(pending, false)).toBe(false);
    expect(
      canResolvePendingRequest(
        { ...pending, request: {} as ServerRequest },
        true,
      ),
    ).toBe(false);
  });
});
