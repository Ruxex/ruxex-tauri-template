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
  totalAmount: 0.42,
  lastAmount: 0.03,
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

  it("shows workspace actions when token usage is unavailable", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(
      <ThreadSummaryPanel
        tokenUsage={null}
        gitDiff={null}
        onOpenTerminal={() => {}}
        onOpenWorkspace={() => {}}
        onOpenEditor={async () => {}}
      />,
    );

    expect(screen.getByTestId("thread-summary-panel")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open terminal in right pane" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open workspace in file manager" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open workspace in editor" }),
    ).toBeTruthy();
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

  it("renders subagents inside the DaisyUI collapse component", async () => {
    const { ThreadSummaryPanel } = await import("./ThreadSummaryPanel");

    render(
      <ThreadSummaryPanel
        tokenUsage={null}
        gitDiff={null}
        subagents={[
          {
            threadId: "agent-1",
            label: "API scout",
            role: "researcher",
            task: "Inspect the API",
            status: "active",
            summary: null,
            updatedAt: 1,
            waitingForApproval: false,
          },
        ]}
      />,
    );

    const summary = screen.getByText("Subagents");
    const collapse = summary.closest("details");

    expect(collapse?.classList.contains("collapse")).toBe(true);
    expect(collapse?.classList.contains("collapse-arrow")).toBe(true);
    expect(
      summary.closest("summary")?.classList.contains("collapse-title"),
    ).toBe(true);
    expect(collapse?.querySelector(".collapse-content")).toBeTruthy();
  });
});
