// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import type { ConversationViewItem } from "../conversation/conversation-model";
import { ChatActivityTimeline } from "./ChatActivityTimeline";

const activity = vi.hoisted(() => vi.fn());
const conversation = vi.hoisted(() => vi.fn());
const serverRequest = vi.hoisted(() => vi.fn());

vi.mock("../conversation/ActivityItem", () => ({
  ActivityItem: (props: { item: ConversationViewItem }) => {
    const [instance] = useState(() => Math.random().toString());
    activity(props);
    return (
      <div data-instance={instance} data-testid="activity-item">
        <span>Activity: {props.item.title}</span>
        <span>{props.item.text}</span>
      </div>
    );
  },
}));
vi.mock("../conversation/ConversationItem", () => ({
  ConversationItem: (props: {
    item: ConversationViewItem;
    onEdit?: (item: ConversationViewItem) => void;
    isStreaming?: boolean;
  }) => {
    conversation(props);
    return (
      <div data-testid="conversation-item">
        Message: {props.item.text}
        {props.onEdit && props.item.type === "userMessage" && (
          <button type="button" onClick={() => props.onEdit?.(props.item)}>
            Edit message
          </button>
        )}
      </div>
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

function viewItem(
  id: string,
  type: ConversationViewItem["type"],
  text: string,
  category: ConversationViewItem["category"],
): ConversationViewItem {
  return {
    id,
    turnId: "turn-1",
    type,
    category,
    title: category === "message" ? "Ruxex" : "Command",
    text,
  };
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: { configurable: true, value: metrics.scrollTop, writable: true },
    scrollTo: { configurable: true, value: vi.fn() },
  });
  fireEvent.scroll(element);
}

function timelineProps(items: ConversationViewItem[]) {
  return {
    connected: true,
    items,
    liveItems: [],
    onReject: vi.fn(),
    onResolve: vi.fn(),
    onEdit: vi.fn(),
    pendingRequests: [],
  };
}

describe("ChatActivityTimeline", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("attaches the supplied timeline ref to the chat activity region", () => {
    const timelineRef = { current: null as HTMLElement | null };

    render(
      <ChatActivityTimeline {...timelineProps([])} timelineRef={timelineRef} />,
    );

    expect(timelineRef.current).toBe(
      screen.getByRole("region", { name: "Chat activity" }),
    );
  });

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
      <ChatActivityTimeline
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

  it("marks only the active assistant message as streaming", () => {
    conversation.mockClear();

    render(
      <ChatActivityTimeline
        connected
        items={[
          viewItem("user-1", "userMessage", "Request", "message"),
          viewItem("agent-1", "agentMessage", "Reply", "message"),
        ]}
        liveItems={[]}
        liveStatus="running"
        workingTurnId="turn-1"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(conversation.mock.calls.map(([props]) => props.isStreaming)).toEqual(
      [false, true],
    );
  });

  it("does not render empty agent messages", () => {
    render(
      <ChatActivityTimeline
        {...timelineProps([
          viewItem("empty-agent-message", "agentMessage", "   ", "message"),
          viewItem(
            "visible-agent-message",
            "agentMessage",
            "Visible reply",
            "message",
          ),
          viewItem("activity-1", "commandExecution", "ls", "activity"),
        ])}
      />,
    );

    expect(screen.getAllByTestId("conversation-item")).toHaveLength(1);
    expect(screen.getByText("Message: Visible reply")).toBeTruthy();
    expect(screen.getByTestId("activity-item")).toBeTruthy();
  });

  it("renders pending requests after conversation items", () => {
    render(
      <ChatActivityTimeline
        connected
        items={[viewItem("message-1", "agentMessage", "Reply", "message")]}
        liveItems={[]}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[pendingRequest("thread-1")]}
      />,
    );

    const timeline = screen.getByRole("region", { name: "Chat activity" });
    expect(
      Array.from(timeline.children).map((child) =>
        child.getAttribute("data-testid"),
      ),
    ).toEqual(["conversation-item", "pending-request"]);
  });

  it("does not show a working indicator while waiting for a pending request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(43_000));

    render(
      <ChatActivityTimeline
        connected
        items={[
          {
            ...viewItem("history-1", "agentMessage", "Earlier", "message"),
            turnId: "turn-0",
          },
          viewItem("message-1", "agentMessage", "Reply", "message"),
        ]}
        liveItems={[
          {
            id: "live-1",
            threadId: "thread-1",
            turnId: "turn-1",
            type: "agentMessage",
            text: "Streaming",
          },
        ]}
        liveStatus="running"
        workingTurnId="turn-1"
        workingStartedAt={1}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[pendingRequest("thread-1")]}
      />,
    );

    expect(screen.queryByRole("status")).toBeNull();

    const timeline = screen.getByRole("region", { name: "Chat activity" });
    expect(timeline.children[0]?.getAttribute("data-testid")).toBe(
      "conversation-item",
    );
    expect(timeline.children[1]?.getAttribute("data-testid")).toBe(
      "conversation-item",
    );
    expect(timeline.lastElementChild).toBe(
      screen.getByTestId("pending-request"),
    );
  });

  it("shows loading dots while running without a pending request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(43_000));

    render(
      <ChatActivityTimeline
        connected
        items={[
          viewItem("user-1", "userMessage", "Request", "message"),
          viewItem("activity-1", "commandExecution", "pnpm test", "activity"),
          viewItem("message-1", "agentMessage", "Reply", "message"),
        ]}
        liveItems={[]}
        liveStatus="running"
        workingTurnId="turn-1"
        workingStartedAt={1}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    const working = screen.getByRole("status", { name: "Working for 42s" });
    expect(working.textContent).toBe("Working for 42s");
    expect(screen.getByTestId("working-indicator-label").textContent).toBe(
      "Working for 42s",
    );
    expect(screen.getByTestId("working-indicator-dots")).toBeTruthy();
    expect(working.querySelector(".loading-spinner")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(
      screen.getByRole("status", { name: "Working for 45s" }),
    ).toBeTruthy();
  });

  it("places the active working indicator after the user message", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(43_000));
    const userMessage = viewItem(
      "user-1",
      "userMessage",
      "Think through this",
      "message",
    );
    const activityItem = viewItem(
      "activity-1",
      "commandExecution",
      "pnpm test",
      "activity",
    );

    render(
      <ChatActivityTimeline
        connected
        items={[userMessage, activityItem]}
        liveItems={[]}
        liveStatus="running"
        workingTurnId="turn-1"
        workingStartedAt={1}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    const timeline = screen.getByRole("region", { name: "Chat activity" });
    expect(timeline.children[0]?.getAttribute("data-testid")).toBe(
      "conversation-item",
    );
    expect(timeline.children[1]).toBe(
      screen.getByRole("status", { name: "Working for 42s" }),
    );
  });

  it("renders the completed turn duration at the completed turn", () => {
    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 241,
            durationMs: 242_000,
            status: "completed",
          } as never
        }
        items={[
          viewItem("user-1", "userMessage", "Request", "message"),
          viewItem("activity-1", "commandExecution", "pnpm test", "activity"),
          viewItem("message-1", "agentMessage", "Reply", "message"),
        ]}
        liveItems={[]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    const worked = screen.getByText("Worked for 4m 2s");
    const details = worked.closest("details");
    expect(details).toBeTruthy();
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    expect(timeline.children[0]?.getAttribute("data-testid")).toBe(
      "conversation-item",
    );
    expect(timeline.children[1]).toBe(details);
    expect(timeline.children[2]?.getAttribute("data-testid")).toBe(
      "conversation-item",
    );
  });

  it("falls back to completed and started timestamps when duration is absent", () => {
    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 100,
            completedAt: 102.5,
            durationMs: null,
            status: "completed",
          } as never
        }
        items={[
          viewItem("user-1", "userMessage", "Request", "message"),
          viewItem("activity-1", "commandExecution", "pnpm test", "activity"),
          viewItem("message-1", "agentMessage", "Reply", "message"),
        ]}
        liveItems={[]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.getByText("Worked for 2s")).toBeTruthy();
  });

  it("collapses completed turn details and keeps its final response visible", () => {
    const items = [
      viewItem("user-1", "userMessage", "Original request", "message"),
      viewItem("reasoning-1", "reasoning", "Thinking", "activity"),
      viewItem("message-1", "agentMessage", "Intermediate reply", "message"),
      viewItem("command-1", "commandExecution", "pnpm test", "activity"),
      viewItem("message-2", "agentMessage", "Final answer", "message"),
    ];

    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 241,
            durationMs: 242_000,
            status: "completed",
          } as never
        }
        items={items}
        liveItems={[]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    const summary = screen.getByText("Worked for 4m 2s");
    const details = summary.closest("details");
    expect(details).toBeTruthy();
    expect(details?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Message: Final answer")).toBeTruthy();
    expect(within(details as HTMLElement).getByText("Thinking")).toBeTruthy();
    expect(
      within(details as HTMLElement).getByText("Message: Intermediate reply"),
    ).toBeTruthy();
    expect(within(details as HTMLElement).getByText("pnpm test")).toBeTruthy();

    fireEvent.click(summary);
    expect(details?.hasAttribute("open")).toBe(true);
  });

  it("collapses completed turns from authoritative conversation history", () => {
    render(
      <ChatActivityTimeline
        connected
        turns={[
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 241,
            durationMs: 242_000,
            status: "completed",
          } as never,
        ]}
        items={[
          viewItem("user-1", "userMessage", "Original request", "message"),
          viewItem("command-1", "commandExecution", "pnpm test", "activity"),
          viewItem("message-1", "agentMessage", "Final answer", "message"),
        ]}
        liveItems={[]}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    const summary = screen.getByText("Worked for 4m 2s");
    expect(summary.closest("details")?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Message: Final answer")).toBeTruthy();
    expect(screen.getByText("pnpm test")).toBeTruthy();
  });

  it("does not create an empty summary when a completed turn has no intermediate items", () => {
    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 2,
            durationMs: 1_000,
            status: "completed",
          } as never
        }
        items={[
          viewItem("user-1", "userMessage", "Original request", "message"),
          viewItem("message-1", "agentMessage", "Final answer", "message"),
        ]}
        liveItems={[]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.queryByText("Worked for 1s")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
    expect(screen.getByText("Message: Final answer")).toBeTruthy();
  });

  it("keeps failed turn activity expanded", () => {
    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 2,
            durationMs: 1_000,
            status: "failed",
          } as never
        }
        items={[
          viewItem("user-1", "userMessage", "Original request", "message"),
          viewItem("command-1", "commandExecution", "pnpm test", "activity"),
          viewItem("message-1", "agentMessage", "Failure details", "message"),
        ]}
        liveItems={[]}
        liveStatus="failed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(document.querySelector("details")).toBeNull();
    expect(screen.getByText("Activity: Command")).toBeTruthy();
    expect(screen.getByText("pnpm test")).toBeTruthy();
  });

  it("falls back to Working when the start timestamp is invalid", () => {
    render(
      <ChatActivityTimeline
        connected
        items={[]}
        liveItems={[]}
        liveStatus="running"
        workingStartedAt={Number.NaN}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.getByRole("status", { name: "Working" }).textContent).toBe(
      "Working",
    );
    expect(screen.getByTestId("working-indicator-dots")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Working" }).className).toContain(
      "max-w-md",
    );
  });

  it("removes the working indicator when the turn is no longer running", () => {
    render(
      <ChatActivityTimeline
        connected
        items={[]}
        liveItems={[]}
        liveStatus="completed"
        workingStartedAt={1}
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.queryByRole("status", { name: /Working/ })).toBeNull();
  });

  it("does not pair a completed empty card with the generic empty message", () => {
    render(
      <ChatActivityTimeline
        connected
        completedTurn={
          {
            id: "turn-1",
            startedAt: 1,
            completedAt: 2,
            durationMs: 1_000,
            status: "completed",
          } as never
        }
        items={[]}
        liveItems={[]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(screen.getByRole("status", { name: "Worked for 1s" })).toBeTruthy();
    expect(screen.queryByText("No activity yet.")).toBeNull();
  });

  it("does not render a separate empty state when the timeline has no items", () => {
    render(
      <ChatActivityTimeline
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

  it("forwards user-message edits to the conversation item", () => {
    const onEdit = vi.fn();
    const item = viewItem(
      "message-1",
      "userMessage",
      "Original prompt",
      "message",
    );

    render(<ChatActivityTimeline {...timelineProps([item])} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("does not keep completed activity marked busy", () => {
    render(
      <ChatActivityTimeline
        connected
        items={[]}
        liveItems={[
          {
            id: "live-1",
            threadId: "thread-1",
            turnId: "turn-1",
            type: "agentMessage",
            text: "Done",
          },
        ]}
        liveStatus="completed"
        onReject={vi.fn()}
        onResolve={vi.fn()}
        pendingRequests={[]}
      />,
    );

    expect(
      screen.getByLabelText("Chat activity").getAttribute("aria-busy"),
    ).toBe("false");
  });

  it("does not scroll existing history on initial render", () => {
    render(
      <ChatActivityTimeline
        {...timelineProps([
          viewItem("message-1", "agentMessage", "Older reply", "message"),
        ])}
      />,
    );

    const timeline = screen.getByRole("region", { name: "Chat activity" });
    setScrollMetrics(timeline, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 0,
    });

    expect(timeline.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the bottom when a new user message is added", () => {
    const initialItems = [
      viewItem("message-1", "agentMessage", "Older reply", "message"),
    ];
    const { rerender } = render(
      <ChatActivityTimeline {...timelineProps(initialItems)} />,
    );
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    setScrollMetrics(timeline, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 0,
    });

    rerender(
      <ChatActivityTimeline
        {...timelineProps([
          ...initialItems,
          viewItem("message-2", "userMessage", "New request", "message"),
        ])}
      />,
    );

    expect(timeline.scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: 1000,
    });
  });

  it("does not scroll to a new reply while the user is reading history", () => {
    const initialItems = [
      viewItem("message-1", "agentMessage", "Older reply", "message"),
    ];
    const { rerender } = render(
      <ChatActivityTimeline {...timelineProps(initialItems)} />,
    );
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    setScrollMetrics(timeline, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 0,
    });

    rerender(
      <ChatActivityTimeline
        {...timelineProps([
          ...initialItems,
          viewItem("message-2", "agentMessage", "New reply", "message"),
        ])}
      />,
    );

    expect(timeline.scrollTo).not.toHaveBeenCalled();
  });

  it("follows new and streaming replies when the user is at the bottom", () => {
    const initialItems = [
      viewItem("message-1", "userMessage", "New request", "message"),
    ];
    const { rerender } = render(
      <ChatActivityTimeline {...timelineProps(initialItems)} />,
    );
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    setScrollMetrics(timeline, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 580,
    });

    const reply = viewItem("message-2", "agentMessage", "Reply", "message");
    rerender(
      <ChatActivityTimeline {...timelineProps([...initialItems, reply])} />,
    );
    rerender(
      <ChatActivityTimeline
        {...timelineProps([
          ...initialItems,
          { ...reply, text: "Reply with more detail" },
        ])}
      />,
    );

    expect(timeline.scrollTo).toHaveBeenCalledTimes(2);
    expect(timeline.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 1000,
    });
  });

  it("scrolls the outer conversation container instead of the timeline", () => {
    const initialItems = [
      viewItem("message-1", "userMessage", "New request", "message"),
    ];
    const { rerender } = render(
      <div data-conversation-scroll data-testid="conversation-scroll">
        <ChatActivityTimeline {...timelineProps(initialItems)} />
      </div>,
    );
    const container = screen.getByTestId("conversation-scroll");
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    setScrollMetrics(container, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 580,
    });

    rerender(
      <div data-conversation-scroll data-testid="conversation-scroll">
        <ChatActivityTimeline
          {...timelineProps([
            ...initialItems,
            viewItem("message-2", "agentMessage", "Reply", "message"),
          ])}
        />
      </div>,
    );

    expect(container.scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: 1000,
    });
    expect(timeline.scrollTo).toBeUndefined();
  });

  it("reconciles activities by turn and item identity", () => {
    const baseItem: ConversationViewItem = {
      id: "command-1",
      turnId: "turn-1",
      type: "commandExecution",
      category: "activity",
      title: "Command",
      text: "first",
    };
    const props = {
      connected: true,
      items: [baseItem],
      liveItems: [],
      onReject: vi.fn(),
      onResolve: vi.fn(),
      pendingRequests: [],
    };
    const { rerender } = render(<ChatActivityTimeline {...props} />);
    const firstInstance = screen
      .getByTestId("activity-item")
      .getAttribute("data-instance");

    rerender(
      <ChatActivityTimeline
        {...props}
        items={[{ ...baseItem, turnId: "turn-2", text: "second" }]}
      />,
    );

    expect(
      screen.getByTestId("activity-item").getAttribute("data-instance"),
    ).not.toBe(firstInstance);
  });

  it("does not rerender the timeline items when only equivalent props are recreated", () => {
    const item = viewItem(
      "message-1",
      "agentMessage",
      "Stable reply",
      "message",
    );
    const onEdit = vi.fn();
    const onReject = vi.fn();
    const onResolve = vi.fn();
    const props = {
      connected: true,
      liveItems: [],
      onEdit,
      onReject,
      onResolve,
      pendingRequests: [],
    };
    const { rerender } = render(
      <ChatActivityTimeline {...props} items={[item]} />,
    );
    conversation.mockClear();

    rerender(<ChatActivityTimeline {...props} items={[{ ...item }]} />);

    expect(conversation).not.toHaveBeenCalled();
  });
});
