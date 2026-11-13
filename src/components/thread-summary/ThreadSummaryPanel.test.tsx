// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

  it("renders only token usage in the summary", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel tokenUsage={usage} gitDiff={null} />);

    expect(
      screen.queryByRole("heading", { name: "Thread Summary" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close Thread Summary" }),
    ).toBeNull();
    expect(screen.getByTestId("thread-summary-panel")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    expect(screen.queryByText("Subagents")).toBeNull();
    expect(screen.queryByText("Sources / Web Search")).toBeNull();
    expect(screen.queryByText("TBD")).toBeNull();
  });

  it("hides the summary when token usage is unavailable", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(<ThreadSummaryPanel tokenUsage={null} gitDiff={null} />);

    expect(screen.queryByTestId("thread-summary-panel")).toBeNull();
  });

  it("renders code additions and deletions without token usage", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(
      <ThreadSummaryPanel
        tokenUsage={null}
        gitDiff={{ added: 12, deleted: 4, files: 3 }}
      />,
    );

    expect(screen.getByText("Changes")).toBeTruthy();
    expect(screen.getByText("+12")).toBeTruthy();
    expect(screen.getByText("−4")).toBeTruthy();
    expect(screen.getByText("(3)")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Token Usage" })).toBeNull();
  });
});
