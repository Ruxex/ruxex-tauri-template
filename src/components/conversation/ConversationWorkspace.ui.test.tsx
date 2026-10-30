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
        },
      },
    });
    resync.mockReset();
    resync.mockResolvedValue(undefined);
    clearThreadLiveItems.mockReset();
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
    const root = composer.closest("div.flex");
    expect(root).not.toBeNull();
    expect(root?.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        "min-h-full",
        "w-full",
        "max-w-[980px]",
        "mx-auto",
      ]),
    );
    expect(root?.className.split(/\s+/)).not.toContain("h-full");
    expect(composer.parentElement?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["sticky", "pb-2"]),
    );
    expect(
      screen
        .getByRole("region", { name: "Chat activity" })
        .className.split(/\s+/),
    ).not.toEqual(expect.arrayContaining(["flex-1", "overflow-y-auto"]));
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
