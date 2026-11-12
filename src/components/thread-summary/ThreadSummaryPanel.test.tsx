// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useSubagentThreadList = vi.hoisted(() => vi.fn());
const useAppServerEvents = vi.hoisted(() => vi.fn());
const useServerRequests = vi.hoisted(() => vi.fn());
const useThreadConversation = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useServerRequests,
  useSubagentThreadList,
  useThreadConversation,
}));
vi.mock("../conversation/ConversationItem", () => ({
  ConversationItem: ({ item }: { item: { text: string } }) => (
    <div data-testid="child-conversation-item">{item.text}</div>
  ),
}));

const childThreads = [
  {
    id: "child-active",
    preview: "Inspect the API client",
    updatedAt: 200,
    agentNickname: "API scout",
    agentRole: "researcher",
    status: { type: "active", activeFlags: [] },
  },
  {
    id: "child-done",
    preview: "Run the test suite",
    updatedAt: 300,
    agentNickname: "Test runner",
    agentRole: null,
    status: { type: "idle" },
  },
] as never;

describe("ThreadSummaryPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useSubagentThreadList.mockReturnValue({
      data: { data: childThreads },
      isLoading: false,
      isError: false,
    });
    useAppServerEvents.mockReturnValue({ threads: {} });
    useServerRequests.mockReturnValue([]);
    useThreadConversation.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: {
          data: [
            {
              turnId: "turn-1",
              item: {
                id: "child-item-1",
                type: "agentMessage",
                text: "API scan complete",
              },
            },
          ],
        },
        turns: { data: [] },
        thread: { id: "child-active", name: "API scout" },
      },
    });
  });

  it("renders the five summary sections and four TBD placeholders", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel threadId="parent-1" />);

    expect(
      screen.queryByRole("heading", { name: "Thread Summary" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close Thread Summary" }),
    ).toBeNull();
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "justify-self-end",
    );
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "sticky",
    );
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "top-6",
    );
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "chat-side-column",
    );
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "overflow-visible",
    );
    expect(screen.getByTestId("thread-summary-panel").className).not.toContain(
      "overflow-y-auto",
    );
    const summaryScroll = screen.getByTestId("thread-summary-scroll");
    expect(summaryScroll.className).toContain("h-full");
    expect(summaryScroll.className).toContain("max-h-full");
    expect(summaryScroll.className).toContain("overflow-y-auto");
    expect(screen.getByTestId("thread-summary-panel").className).toContain(
      "text-sm",
    );
    expect(screen.getByTestId("thread-summary-panel").className).not.toContain(
      "lg:border-l",
    );
    expect(screen.getByTestId("thread-summary-content").className).toContain(
      "h-fit",
    );
    for (const label of [
      "Subagents",
      "Sources / Web Search",
      "Changes",
      "Branch details",
      "Git actions",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("TBD")).toHaveLength(4);
  });

  it("groups child agents and opens a selected child thread", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel threadId="parent-1" />);

    expect(screen.getByRole("heading", { name: "Active" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Done" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /API scout/ }));

    expect(screen.getByRole("heading", { name: /API scout/ })).toBeTruthy();
    expect(screen.getByText("API scan complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to subagents" }));
    expect(screen.getByRole("button", { name: /API scout/ })).toBeTruthy();
  });

  it("renders an empty state when there are no child agents", async () => {
    useSubagentThreadList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel threadId="parent-1" />);

    expect(screen.getByText("No subagents yet.")).toBeTruthy();
  });
});
