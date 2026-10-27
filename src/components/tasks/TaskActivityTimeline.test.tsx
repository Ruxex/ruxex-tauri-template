// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import type { ConversationViewItem } from "../conversation/conversation-model";
import { TaskActivityTimeline } from "./TaskActivityTimeline";

const activity = vi.hoisted(() => vi.fn());
const conversation = vi.hoisted(() => vi.fn());
const serverRequest = vi.hoisted(() => vi.fn());

vi.mock("../conversation/ActivityItem", () => ({
  ActivityItem: (props: { item: ConversationViewItem }) => {
    activity(props);
    return <div data-testid="activity-item">Activity: {props.item.title}</div>;
  },
}));
vi.mock("../conversation/ConversationItem", () => ({
  ConversationItem: (props: { item: ConversationViewItem }) => {
    conversation(props);
    return (
      <div data-testid="conversation-item">Message: {props.item.text}</div>
    );
  },
}));
vi.mock("../approvals/ServerRequestCard", () => ({
  ServerRequestCard: (props: {
    pending: PendingServerRequest;
    onReject: (message: string) => Promise<void>;
    onResolve: (result: unknown) => Promise<void>;
  }) => {
    serverRequest(props);
    return (
      <div data-testid="pending-request">
        Pending request: {String(props.pending.requestId)}
        <button
          type="button"
          onClick={() => void props.onResolve({ ok: true })}
        >
          Resolve request
        </button>
      </div>
    );
  },
}));

function pendingRequest(threadId: string): PendingServerRequest {
  return {
    requestId: 42,
    kind: "approval",
    request: {
      id: 42,
      method: "item/tool/requestApproval",
      params: { threadId },
    } as never,
    threadId,
    turnId: "turn-1",
    itemId: "item-1",
  };
}

describe("TaskActivityTimeline", () => {
  it("renders messages, activities, and actionable pending requests", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const onReject = vi.fn().mockResolvedValue(undefined);
    const items: ConversationViewItem[] = [
      {
        id: "message-1",
        turnId: "turn-1",
        type: "agentMessage",
        category: "message",
        title: "Ruxex",
        text: "Implemented the change",
      },
      {
        id: "activity-1",
        turnId: "turn-1",
        type: "commandExecution",
        category: "activity",
        title: "Command",
        text: "pnpm test",
      },
    ];

    render(
      <TaskActivityTimeline
        connected
        items={items}
        liveItems={[]}
        onReject={onReject}
        onResolve={onResolve}
        pendingRequests={[pendingRequest("thread-1")]}
      />,
    );

    expect(screen.getByText("Message: Implemented the change")).toBeTruthy();
    expect(screen.getByText("Activity: Command")).toBeTruthy();
    expect(screen.getByText("Pending request: 42")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resolve request" }));

    await vi.waitFor(() =>
      expect(onResolve).toHaveBeenCalledWith(42, { ok: true }),
    );
    expect(conversation).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledOnce();
    expect(serverRequest).toHaveBeenCalledOnce();
  });

  it("does not render a separate empty state when the timeline has no items", () => {
    render(
      <TaskActivityTimeline
        connected
        items={[]}
        liveItems={[]}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.getByText("No activity yet.")).toBeTruthy();
  });
});
