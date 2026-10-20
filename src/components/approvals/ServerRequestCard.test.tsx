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

    expect(screen.getByText(/Disconnected/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
  });
});
