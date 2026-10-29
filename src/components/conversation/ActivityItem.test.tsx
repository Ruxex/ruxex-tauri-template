// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserWindow = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({ openBrowserWindow }));

import { ActivityItem } from "./ActivityItem";

describe("ActivityItem", () => {
  afterEach(cleanup);

  it.each([
    ["commandExecution", "Command"],
    ["dynamicToolCall", "Tool"],
    ["mcpToolCall", "MCP tool"],
  ])("renders a dedicated icon for %s activity", (type, label) => {
    render(
      <ActivityItem
        item={{
          id: `${type}-1`,
          turnId: "turn-1",
          type,
          category: "activity",
          title: label,
          text: "done",
          metadata: { status: "completed" },
        }}
      />,
    );

    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it("shows a spinner while an activity is in progress", () => {
    render(
      <ActivityItem
        item={{
          id: "mcp-progress-1",
          turnId: "turn-1",
          type: "mcpToolCall",
          category: "activity",
          title: "MCP: docs / search",
          text: "waiting for tool",
          metadata: { status: "inProgress" },
        }}
      />,
    );

    expect(screen.getByRole("status", { name: "Running" })).toBeTruthy();
  });

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

  it("stacks command and result without visible labels", () => {
    render(
      <ActivityItem
        item={{
          id: "command-2",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "done",
          metadata: { command: "pnpm test", exitCode: "0" },
        }}
      />,
    );

    const commandContent = screen.getByTestId("command-execution-content");
    const command = screen.getByTestId("command-execution-command");
    const result = screen.getByTestId("command-execution-result");

    expect(commandContent.contains(command)).toBe(true);
    expect(commandContent.contains(result)).toBe(true);
    expect(command.textContent).toBe("pnpm test");
    expect(result.textContent).toContain("done");
    expect(result.className).toContain("border-t");
    expect(screen.queryByText("command", { exact: true })).toBeNull();
    expect(screen.queryByText("result", { exact: true })).toBeNull();
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
