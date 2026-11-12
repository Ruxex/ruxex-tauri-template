// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppServerEvents = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
}));

const usage = {
  total: {
    totalTokens: 123456,
    inputTokens: 100000,
    cachedInputTokens: 12000,
    cacheWriteInputTokens: 1000,
    outputTokens: 23456,
    reasoningOutputTokens: 3456,
  },
  last: {
    totalTokens: 4567,
    inputTokens: 3000,
    cachedInputTokens: 400,
    cacheWriteInputTokens: 100,
    outputTokens: 1567,
    reasoningOutputTokens: 200,
  },
  modelContextWindow: 200000,
};

describe("ThreadSummaryPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppServerEvents.mockReturnValue({
      threads: { "parent-1": { tokenUsage: usage } },
    });
  });

  it("renders only token usage in the summary", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel threadId="parent-1" />);

    expect(
      screen.queryByRole("heading", { name: "Thread Summary" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close Thread Summary" }),
    ).toBeNull();
    const summaryPanel = screen.getByTestId("thread-summary-panel");
    const summaryColumn = summaryPanel.parentElement;
    expect(summaryColumn?.className).toContain("justify-self-end");
    expect(summaryColumn?.className).toContain("sticky");
    expect(summaryColumn?.className).toContain("top-6");
    expect(summaryColumn?.className).toContain("chat-side-column");
    expect(summaryPanel.className).toContain("rounded-box");
    expect(summaryPanel.className).toContain("max-w-72");
    expect(summaryPanel.className).toContain("ml-auto");
    expect(summaryColumn?.className).toContain("overflow-hidden");
    expect(summaryPanel.className).not.toContain("overflow-y-auto");
    const summaryScroll = screen.getByTestId("thread-summary-scroll");
    expect(summaryScroll.className).toContain("h-full");
    expect(summaryScroll.className).toContain("max-h-full");
    expect(summaryScroll.className).toContain("overflow-y-auto");
    expect(summaryPanel.className).toContain("text-xs");
    expect(summaryPanel.className).not.toContain("lg:border-l");
    expect(screen.getByTestId("thread-summary-content").className).toContain(
      "h-fit",
    );
    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    expect(screen.getByText("Input")).toBeTruthy();
    expect(screen.getByText("Output")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.queryByText("Subagents")).toBeNull();
    expect(screen.queryByText("Sources / Web Search")).toBeNull();
    expect(screen.queryByText("TBD")).toBeNull();
  });

  it("hides the summary when token usage is unavailable", async () => {
    useAppServerEvents.mockReturnValueOnce({ threads: {} });
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel threadId="parent-1" />);

    expect(screen.queryByTestId("thread-summary-panel")).toBeNull();
  });
});
