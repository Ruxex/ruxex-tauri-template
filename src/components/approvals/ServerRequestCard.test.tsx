// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import { ServerRequestCard } from "./ServerRequestCard";

const pending = {
  requestId: 17,
  kind: "approval",
  threadId: "thread-1",
  turnId: "turn-1",
  itemId: "item-1",
  request: {
    method: "item/commandExecution/requestApproval",
    id: 17,
    params: {
      command: "pnpm check",
      cwd: "/workspace",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
    },
  },
} as never as PendingServerRequest;

const mcpPending = {
  requestId: 23,
  kind: "elicitation",
  threadId: "thread-1",
  turnId: "turn-1",
  itemId: null,
  request: {
    method: "mcpServer/elicitation/request",
    id: 23,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      serverName: "ruxex_smoke",
      mode: "form",
      _meta: {
        ruxex_approval_kind: "mcp_tool_call",
        tool_title: "Echo",
        tool_params_display: [
          { name: "message", displayName: "message", value: "smoke-v1" },
        ],
      },
      message: 'Allow the ruxex_smoke MCP server to run tool "echo"?',
      requestedSchema: { type: "object", properties: {} },
    },
  },
} as never as PendingServerRequest;

describe("ServerRequestCard", () => {
  afterEach(cleanup);

  it("shows the server-provided command scope and resolves an approval", () => {
    const onResolve = vi.fn(async () => undefined);
    render(
      <ServerRequestCard
        connected
        onReject={vi.fn(async () => undefined)}
        onResolve={onResolve}
        pending={pending}
      />,
    );

    expect(screen.getAllByText("pnpm check")).toHaveLength(2);
    expect(screen.getByText("/workspace")).toBeTruthy();
    expect(
      screen
        .getByRole("heading", { name: "Approval requested" })
        .querySelector("svg"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));

    expect(onResolve).toHaveBeenCalledWith({ decision: "accept" });
  });

  it("does not expose approval actions while disconnected", () => {
    render(
      <ServerRequestCard
        connected={false}
        onReject={vi.fn(async () => undefined)}
        onResolve={vi.fn(async () => undefined)}
        pending={pending}
      />,
    );

    expect(
      screen
        .getByText("Disconnected")
        .querySelector("svg")
        ?.getAttribute("class"),
    ).toContain("text-warning");
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
  });

  it("renders MCP tool approval elicitation and resolves Allow", () => {
    const onResolve = vi.fn(async () => undefined);
    render(
      <ServerRequestCard
        connected
        onReject={vi.fn(async () => undefined)}
        onResolve={onResolve}
        pending={mcpPending}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "MCP approval requested" }),
    ).toBeTruthy();
    expect(screen.getByText("ruxex_smoke")).toBeTruthy();
    expect(screen.getByText("smoke-v1")).toBeTruthy();
    expect(
      screen.queryByText('Allow the ruxex_smoke MCP server to run tool "echo"?'),
    ).toBeNull();
    expect(screen.queryByText("thread-1")).toBeNull();
    expect(screen.queryByText("turn-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));

    expect(onResolve).toHaveBeenCalledWith({
      action: "accept",
      content: null,
      _meta: null,
    });
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("resolves MCP tool approval cancellation", () => {
    const onResolve = vi.fn(async () => undefined);
    render(
      <ServerRequestCard
        connected
        onReject={vi.fn(async () => undefined)}
        onResolve={onResolve}
        pending={mcpPending}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onResolve).toHaveBeenCalledWith({
      action: "cancel",
      content: null,
      _meta: null,
    });
  });
});
