// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useServerRequests = vi.hoisted(() => vi.fn());
const useAppServerEvents = vi.hoisted(() => vi.fn());
const resolveServerRequest = vi.hoisted(() => vi.fn());
const rejectServerRequestWithMessage = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useServerRequests,
  useAppServerEvents,
}));
vi.mock("../../app-server/api", () => ({
  resolveServerRequest,
  rejectServerRequestWithMessage,
}));

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
} as never;

describe("ApprovalCenter", () => {
  afterEach(cleanup);

  beforeEach(() => {
    resolveServerRequest.mockReset();
    rejectServerRequestWithMessage.mockReset();
    resolveServerRequest.mockResolvedValue(undefined);
    rejectServerRequestWithMessage.mockResolvedValue(undefined);
    useServerRequests.mockReturnValue([pending]);
    useAppServerEvents.mockReturnValue({ connected: true });
  });

  it("resolves the server request with the selected decision", async () => {
    const { ApprovalCenter } = await import("./ApprovalCenter");

    render(<ApprovalCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));

    expect(resolveServerRequest).toHaveBeenCalledWith(17, {
      decision: "accept",
    });
  });

  it("keeps actions hidden and warns while disconnected", async () => {
    useAppServerEvents.mockReturnValue({ connected: false });
    const { ApprovalCenter } = await import("./ApprovalCenter");

    render(<ApprovalCenter />);

    expect(
      screen.getByText("Reconnect before responding to a request."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
  });

  it("renders an empty state when there are no pending requests", async () => {
    useServerRequests.mockReturnValue([]);
    const { ApprovalCenter } = await import("./ApprovalCenter");

    render(<ApprovalCenter />);

    expect(screen.getByText("No pending approvals.")).toBeTruthy();
  });

  it("rejects unsupported actionable requests through the standard message", async () => {
    useServerRequests.mockReturnValue([
      {
        requestId: 18,
        kind: "other",
        threadId: "thread-1",
        turnId: null,
        itemId: null,
        request: { method: "currentTime/read", id: 18, params: {} },
      },
    ]);
    const { ApprovalCenter } = await import("./ApprovalCenter");

    render(<ApprovalCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(rejectServerRequestWithMessage).toHaveBeenCalledWith(
      18,
      "Unsupported server request",
    );
  });
});
