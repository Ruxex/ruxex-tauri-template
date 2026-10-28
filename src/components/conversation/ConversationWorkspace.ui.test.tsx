// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppServerEvents = vi.hoisted(() => vi.fn());
const useInterruptTurn = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useResumeThread = vi.hoisted(() => vi.fn());
const useStartReview = vi.hoisted(() => vi.fn());
const useThreadConversation = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useInterruptTurn,
  useProject,
  useResumeThread,
  useStartReview,
  useThreadConversation,
}));
vi.mock("./Composer", () => ({
  Composer: () => <div data-testid="composer" />,
}));
vi.mock("./ReviewControls", () => ({ ReviewControls: () => null }));

describe("ConversationWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThreadConversation.mockReturnValue({
      isLoading: false,
      isError: false,
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
        items: { data: [] },
      },
    });
    useInterruptTurn.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useProject.mockReturnValue({ data: undefined });
    useResumeThread.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useStartReview.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutateAsync: vi.fn(),
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
  });

  it("shows an error when the completed turn fails asynchronously", async () => {
    const { ConversationWorkspace } = await import("./ConversationWorkspace");

    render(<ConversationWorkspace threadId="thread-1" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Authentication required",
    );
    expect(screen.getByRole("heading", { name: "Test chat" })).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Task status: Failed" }),
    ).toBeTruthy();

    const composer = screen.getByTestId("composer");
    const root = composer.closest("div.flex");
    expect(root).not.toBeNull();
    expect(root?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["h-[calc(100dvh-9rem)]", "min-h-0"]),
    );
    expect(composer.parentElement?.className.split(/\s+/)).toContain(
      "shrink-0",
    );
    expect(
      screen
        .getByRole("region", { name: "Task activity" })
        .className.split(/\s+/),
    ).toEqual(
      expect.arrayContaining(["flex-1", "min-h-0", "overflow-y-auto"]),
    );
  });
});
