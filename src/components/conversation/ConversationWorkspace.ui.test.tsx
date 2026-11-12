// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppServerEvents = vi.hoisted(() => vi.fn());
const useRetainThreadState = vi.hoisted(() => vi.fn());
const useThreadConversation = vi.hoisted(() => vi.fn());
const useThreadGoal = vi.hoisted(() => vi.fn());
const useThreadQueue = vi.hoisted(() => vi.fn());
const useSubagentThreadList = vi.hoisted(() => vi.fn());
const useServerRequests = vi.hoisted(() => vi.fn());
const useRevertThread = vi.hoisted(() => vi.fn());
const useSendMessage = vi.hoisted(() => vi.fn());
const resync = vi.hoisted(() => vi.fn());
const revertMutation = vi.hoisted(() => vi.fn());
const sendMutation = vi.hoisted(() => vi.fn());
const clearThreadLiveItems = vi.hoisted(() => vi.fn());

const createCompletedTurnEvent = (id: string, turnId: string) => ({
  id,
  event: {
    type: "serverNotification" as const,
    data: {
      method: "turn/completed" as const,
      params: {
        threadId: "thread-1",
        turn: { id: turnId, status: "completed" as const },
      },
    },
  },
});

const initialCompletedTurnEvent = createCompletedTurnEvent(
  "turn-1-completed",
  "turn-1",
);
const laterCompletedTurnEvent = createCompletedTurnEvent(
  "turn-2-completed",
  "turn-2",
);

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useRetainThreadState,
  useThreadConversation,
  useThreadGoal,
  useThreadQueue,
  useSubagentThreadList,
  useServerRequests,
  useRevertThread,
  useSendMessage,
}));
vi.mock("../../app-server/event-store", () => ({ clearThreadLiveItems }));
vi.mock("./Composer", () => ({
  Composer: (props: { initialMessage?: string }) => (
    <div data-testid="composer" data-draft={props.initialMessage ?? ""} />
  ),
}));
describe("ConversationWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThreadConversation.mockReturnValue({
      isLoading: false,
      isError: false,
      resync,
      data: {
        thread: {
          id: "thread-1",
          name: "Test chat",
          preview: null,
          cwd: "/workspace",
          gitInfo: null,
          status: { type: "idle" },
        },
        turns: { data: [] },
        items: {
          data: [
            {
              turnId: "turn-1",
              item: {
                type: "userMessage",
                id: "user-1",
                clientId: null,
                content: [
                  { type: "text", text: "Original prompt", text_elements: [] },
                ],
              },
            },
            {
              turnId: "turn-2",
              item: {
                type: "agentMessage",
                id: "item-1",
                text: "Assistant reply",
              },
            },
          ] as never,
        },
      },
    });
    useThreadQueue.mockReturnValue({
      data: {
        data: [
          {
            id: "queued-1",
            input: [{ type: "text", text: "Queued prompt", text_elements: [] }],
            clientUserMessageId: "client-queued-1",
          },
        ],
        nextCursor: null,
      },
    });
    useThreadGoal.mockReturnValue({ data: { goal: null } });
    useSubagentThreadList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    useServerRequests.mockReturnValue([]);
    revertMutation.mockReset();
    revertMutation.mockResolvedValue({});
    sendMutation.mockReset();
    sendMutation.mockResolvedValue({});
    useRevertThread.mockReturnValue({
      mutateAsync: revertMutation,
      isPending: false,
      error: null,
    });
    useSendMessage.mockReturnValue({
      mutateAsync: sendMutation,
      isPending: false,
      error: null,
    });
    useAppServerEvents.mockReturnValue({
      connected: true,
      history: [initialCompletedTurnEvent],
      pendingServerRequests: {},
      resynchronizing: false,
      skippedEvents: 0,
      lastError: null,
      threads: {
        "thread-1": {
          threadId: "thread-1",
          activeTurnId: null,
          status: "failed",
          items: [],
          completedTurn: {
            id: "turn-1",
            status: "failed",
            error: {
              message: "Authentication required",
              additionalDetails: null,
            },
          },
          tokenUsage: {
            total: {
              totalTokens: 1200,
              inputTokens: 900,
              cachedInputTokens: 100,
              cacheWriteInputTokens: 0,
              outputTokens: 300,
              reasoningOutputTokens: 50,
            },
            last: {
              totalTokens: 400,
              inputTokens: 300,
              cachedInputTokens: 25,
              cacheWriteInputTokens: 0,
              outputTokens: 100,
              reasoningOutputTokens: 10,
            },
            modelContextWindow: 8192,
          },
        },
      },
    });
    resync.mockReset();
    resync.mockResolvedValue(undefined);
    clearThreadLiveItems.mockReset();
  });

  it("shows the thread summary without display toggles", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    expect(screen.getByTestId("thread-summary-panel")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    expect(screen.getByText("1,200")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Open Thread Summary" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close Thread Summary" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Thread Summary" }),
    ).toBeNull();
  });

  it("does not render the minimap before five user messages exist", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    const workspace = screen.getByTestId("chat-workspace");
    const mainChat = screen.getByRole("main");
    expect(
      screen.queryByRole("complementary", { name: "Conversation minimap" }),
    ).toBeNull();
    expect(screen.queryByTestId("conversation-minimap-track")).toBeNull();
    expect(workspace.className).not.toContain("chat-workspace--has-minimap");
    expect(workspace.className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(workspace.className).toContain(
      "@min-[64rem]/chat:grid-cols-[minmax(0,53rem)_minmax(0,1fr)]",
    );
    expect(workspace.className).toContain(
      "@min-[80rem]/chat:grid-cols-[minmax(0,53rem)_minmax(0,24rem)]",
    );
    expect(mainChat.className).toContain("h-full");
  });

  it("uses the responsive chat grid when both supporting columns are available", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    useThreadConversation.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      resync,
      data: {
        thread: {
          id: "thread-1",
          name: "Test chat",
          preview: null,
          cwd: "/workspace",
          gitInfo: null,
          status: { type: "idle" },
        },
        turns: { data: [] },
        items: {
          data: Array.from({ length: 5 }, (_, index) => ({
            turnId: `turn-${index + 1}`,
            item: {
              type: "userMessage",
              id: `user-${index + 1}`,
              clientId: null,
              content: [
                {
                  type: "text",
                  text: `Prompt ${index + 1}`,
                  text_elements: [],
                },
              ],
            },
          })) as never,
        },
      },
    });

    render(<ConversationWorkspace threadId="thread-1" />);

    const workspace = screen.getByTestId("chat-workspace");
    expect(workspace.className).toContain("chat-workspace");
    expect(workspace.className).toContain("chat-workspace--has-minimap");
    expect(workspace.className).toContain("chat-workspace--has-summary");
    expect(workspace.className).not.toContain("overflow-hidden");
    expect(workspace.className).toContain(
      "@min-[64rem]/chat:grid-cols-[minmax(0,1fr)_minmax(0,53rem)_minmax(0,1fr)]",
    );
    expect(workspace.className).toContain(
      "@min-[80rem]/chat:grid-cols-[0_minmax(0,53rem)_minmax(0,24rem)]",
    );
    expect(workspace.className).toContain(
      "@min-[96rem]/chat:grid-cols-[minmax(0,1fr)_minmax(0,53rem)_minmax(0,24rem)]",
    );
    expect(workspace.className).toContain(
      "@min-[120rem]/chat:grid-cols-[minmax(0,1fr)_minmax(0,53rem)_minmax(0,1fr)]",
    );
    expect(workspace.className).not.toContain("min-[1360px]");
    expect(workspace.className).not.toContain("min-[1680px]");
    expect(
      screen.getByRole("complementary", { name: "Conversation minimap" }),
    ).toBeTruthy();
    const summaryPanel = screen.getByTestId("thread-summary-panel");
    expect(summaryPanel.parentElement?.className).toContain(
      "chat-thread-summary-column",
    );
    expect(summaryPanel.className).not.toMatch(/(?:^| )min-w-(?!0(?:$| ))/);
    expect(summaryPanel.className).toContain("hidden");
    expect(summaryPanel.className).toContain("@min-[16rem]/summary:block");
    expect(
      screen.getByRole("complementary", { name: "Conversation minimap" })
        .parentElement?.className,
    ).toContain("sticky");
    expect(summaryPanel.parentElement?.className).toContain("sticky");
    const mainChat = screen.getByRole("main");
    expect(mainChat.className).toContain("h-full");
    expect(mainChat.className).toContain("min-h-0");
    const timeline = screen.getByRole("region", { name: "Chat activity" });
    expect(timeline.className).not.toContain("overflow-y-auto");
    expect(
      screen.getByTestId("composer").parentElement?.className.split(/\s+/),
    ).toEqual(expect.arrayContaining(["shrink-0"]));
    expect(mainChat.getAttribute("data-conversation-scroll")).toBeNull();
  });

  it("shows an error when the completed turn fails asynchronously", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    expect(useRetainThreadState).toHaveBeenCalledWith("thread-1");

    expect(screen.getByRole("alert").textContent).toContain(
      "Authentication required",
    );
    const content = screen
      .getByText("Assistant reply")
      .closest("[data-chat-content]");
    expect(content?.className.split(/\s+/)).toContain("selectable-content");
    expect(screen.queryByRole("heading", { name: "Test chat" })).toBeNull();
    const composer = screen.getByTestId("composer");
    const root = screen.getByTestId("chat-workspace");
    expect(root).not.toBeNull();
    expect(root?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["min-h-full", "w-full", "mx-auto"]),
    );
    expect(root?.className.split(/\s+/)).not.toContain("h-full");
    expect(screen.getByRole("main").className).toContain("h-full");
    expect(composer.parentElement?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["sticky", "pb-2"]),
    );
    expect(
      screen.getByRole("region", { name: "Chat activity" }).className,
    ).not.toContain("overflow-y-auto");
  });

  it("centers the conversation loading indicator", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    useThreadConversation.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      resync,
      data: null,
    });

    const { container } = render(<ConversationWorkspace threadId="thread-1" />);

    const loadingWrapper = container.firstElementChild;
    expect(loadingWrapper?.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        "flex",
        "min-h-full",
        "items-center",
        "justify-center",
      ]),
    );
    expect(container.querySelector(".loading-spinner")?.className).toContain(
      "loading-lg",
    );
  });

  it("keeps showing loading while conversation recovery is pending", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    useThreadConversation.mockReturnValueOnce({
      isLoading: false,
      isPending: true,
      isError: false,
      resync,
      data: null,
    });

    const { container } = render(<ConversationWorkspace threadId="thread-1" />);

    expect(container.querySelector(".loading-spinner")?.className).toContain(
      "loading-lg",
    );
    expect(screen.queryByText("Unable to load this conversation.")).toBeNull();
  });

  it("shows queued messages above the composer on the right", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    const queue = screen.getByRole("region", { name: "Queued messages" });
    const composer = screen.getByTestId("composer");

    expect(queue.compareDocumentPosition(composer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(queue.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "justify-end"]),
    );
    expect(screen.queryByText("Queued messages")).toBeNull();
    expect(screen.getByText("Queued prompt")).toBeTruthy();
  });

  it("shows the current goal above the composer on the left", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    useThreadGoal.mockReturnValueOnce({
      data: {
        goal: {
          threadId: "thread-1",
          objective: "Ship the chat redesign",
          status: "active",
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    });

    render(<ConversationWorkspace threadId="thread-1" />);

    const goal = screen.getByRole("region", { name: "Current goal" });
    const composer = screen.getByTestId("composer");

    expect(goal.compareDocumentPosition(composer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(goal.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "justify-start"]),
    );
    expect(screen.getByText("Ship the chat redesign")).toBeTruthy();
  });

  it("does not fetch when a turn completes", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    await waitFor(() => expect(screen.getByTestId("composer")).toBeTruthy());
    expect(resync).not.toHaveBeenCalled();
  });

  it("does not fetch when a later completion event arrives", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    const view = render(<ConversationWorkspace threadId="thread-1" />);

    await waitFor(() => expect(screen.getByTestId("composer")).toBeTruthy());

    useAppServerEvents.mockReturnValue({
      connected: true,
      history: [initialCompletedTurnEvent, laterCompletedTurnEvent],
      pendingServerRequests: {},
      resynchronizing: false,
      threads: {
        "thread-1": {
          threadId: "thread-1",
          activeTurnId: null,
          status: "failed",
          items: [],
          completedTurn: {
            id: "turn-1",
            status: "failed",
            error: {
              message: "Authentication required",
              additionalDetails: null,
            },
          },
        },
      },
    });
    view.rerender(<ConversationWorkspace threadId="thread-1" />);

    expect(resync).not.toHaveBeenCalled();
  });

  it("resynchronizes after the event stream reports lagged events", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    useAppServerEvents.mockReturnValue({
      connected: true,
      history: [initialCompletedTurnEvent],
      pendingServerRequests: {},
      resynchronizing: true,
      skippedEvents: 3,
      lastError: null,
      threads: {},
    });

    render(<ConversationWorkspace threadId="thread-1" />);

    await waitFor(() => expect(resync).toHaveBeenCalledTimes(1));
    expect(clearThreadLiveItems.mock.calls[0]?.[0]).toBe("thread-1");
  });

  it("keeps live overlays when recovery fails", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");
    resync.mockRejectedValueOnce(new Error("recovery failed"));
    useAppServerEvents.mockReturnValue({
      connected: true,
      history: [initialCompletedTurnEvent],
      pendingServerRequests: {},
      resynchronizing: true,
      skippedEvents: 3,
      lastError: null,
      threads: {},
    });

    render(<ConversationWorkspace threadId="thread-1" />);

    await waitFor(() => expect(resync).toHaveBeenCalledTimes(1));
    expect(clearThreadLiveItems).not.toHaveBeenCalled();
  });

  it("reverts an edited user message and starts the edited text", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message" }), {
      target: { value: "Corrected prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(revertMutation).toHaveBeenCalledWith({
        threadId: "thread-1",
        beforeTurnId: "turn-1",
      }),
    );
    await waitFor(() =>
      expect(sendMutation).toHaveBeenCalledWith({
        threadId: "thread-1",
        input: [{ type: "text", text: "Corrected prompt", text_elements: [] }],
        model: null,
        effort: null,
        turnTrigger: null,
      }),
    );
    expect(revertMutation.mock.invocationCallOrder[0]).toBeLessThan(
      sendMutation.mock.invocationCallOrder[0],
    );
  });
});
