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
const useThreadConversation = vi.hoisted(() => vi.fn());
const useRevertThread = vi.hoisted(() => vi.fn());
const refetch = vi.hoisted(() => vi.fn());
const revertMutation = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useThreadConversation,
  useRevertThread,
}));
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
      refetch,
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
              item: { type: "agentMessage", id: "item-1", text: "Assistant reply" },
            },
          ] as never,
        },
      },
    });
    revertMutation.mockReset();
    revertMutation.mockResolvedValue({});
    useRevertThread.mockReturnValue({
      mutateAsync: revertMutation,
      isPending: false,
      error: null,
    });
    useAppServerEvents.mockReturnValue({
      connected: true,
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
    refetch.mockReset();
    refetch.mockResolvedValue(undefined);
  });

  it("shows an error when the completed turn fails asynchronously", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Authentication required",
    );
    const content = screen.getByText("Assistant reply").closest(
      "[data-chat-content]",
    );
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

  it("refreshes the authoritative conversation when a turn completes", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
  });

  it("reverts an edited user message and restores its text to the composer", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));

    await waitFor(() =>
      expect(revertMutation).toHaveBeenCalledWith({
        threadId: "thread-1",
        beforeTurnId: "turn-1",
      }),
    );
    expect(screen.getByTestId("composer").getAttribute("data-draft")).toBe(
      "Original prompt",
    );
  });
});
