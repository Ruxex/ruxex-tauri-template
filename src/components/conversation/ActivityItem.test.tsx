// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserWindow = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({ openBrowserWindow }));

import { ActivityItem } from "./ActivityItem";

describe("ActivityItem", () => {
  afterEach(cleanup);

  it("keeps diagnostic metadata visible in a collapsed activity", () => {
    render(
      <ActivityItem
        item={{
          id: "command-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "done",
          metadata: { command: "pnpm test", exitCode: "0" },
        }}
      />,
    );

    expect(screen.getByText("Command")).toBeTruthy();
    expect(screen.getByText("pnpm test")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
  });

  it("renders diff activity using the shared Markdown renderer", () => {
    render(
      <ActivityItem
        item={{
          id: "change-1",
          turnId: "turn-1",
          type: "fileChange",
          category: "activity",
          title: "Changes",
          text: "```diff\n+added\n-removed\n```",
        }}
      />,
    );

    expect(screen.getByTestId("diff-added").textContent).toContain("+added");
    expect(screen.getByTestId("diff-removed").textContent).toContain(
      "-removed",
    );
  });

  it("offers an explicit browser action for Browser tool results", () => {
    render(
      <ActivityItem
        item={{
          id: "browser-1",
          turnId: "turn-1",
          type: "dynamicToolCall",
          category: "activity",
          title: "Tool: browser.navigate",
          text: "opened",
          browserUrl: "https://example.test/session",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open in browser" }));

    expect(openBrowserWindow).toHaveBeenCalledWith(
      "https://example.test/session",
    );
  });
});
