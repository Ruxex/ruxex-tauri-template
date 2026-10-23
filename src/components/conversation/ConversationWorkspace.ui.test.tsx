// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppServerEvents = vi.hoisted(() => vi.fn());
const useThreadConversation = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useThreadConversation,
}));
vi.mock("./Composer", () => ({ Composer: () => null }));
vi.mock("./ReviewControls", () => ({ ReviewControls: () => null }));

describe("ConversationWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThreadConversation.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        thread: { id: "thread-1", name: "Test chat", preview: null },
        turns: { data: [] },
        items: { data: [] },
      },
    });
    useAppServerEvents.mockReturnValue({
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
  });

  it("shows an error when the completed turn fails asynchronously", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Authentication required",
    );
  });
});
