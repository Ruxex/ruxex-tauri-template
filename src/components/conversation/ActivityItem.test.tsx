// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserWindow = vi.hoisted(() => vi.fn());
const previewArtifact = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({
  openBrowserWindow,
  previewArtifact,
}));

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

  it("does not repeat the command activity type beside Command", () => {
    render(
      <ActivityItem
        item={{
          id: "command-label-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "done",
          metadata: { status: "completed" },
        }}
      />,
    );

    expect(screen.queryByText("Command execution")).toBeNull();
    expect(screen.getByText("Command")).toBeTruthy();
    expect(screen.queryByText("commandExecution")).toBeNull();
  });

  it("does not repeat status or exit code in non-command activity details", () => {
    render(
      <ActivityItem
        item={{
          id: "tool-1",
          turnId: "turn-1",
          type: "dynamicToolCall",
          category: "activity",
          title: "Inspect repository",
          text: "done",
          metadata: {
            namespace: "filesystem",
            status: "completed",
            exitCode: "0",
          },
        }}
      />,
    );

    expect(screen.getByText("filesystem")).toBeTruthy();
    expect(screen.queryByText("status", { exact: true })).toBeNull();
    expect(screen.queryByText("exitCode", { exact: true })).toBeNull();
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

  it("places a command loading icon after the title", () => {
    render(
      <ActivityItem
        item={{
          id: "command-progress-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "waiting",
          metadata: {
            command: "pnpm test",
            status: "inProgress",
          },
        }}
      />,
    );

    const loadingIcon = screen.getAllByRole("img", {
      name: "Command running",
    })[0];
    expect(loadingIcon).toBeTruthy();
    expect(loadingIcon.className).toContain("items-center");
    expect(loadingIcon.className).toContain("justify-center");
    expect(loadingIcon.parentElement?.previousElementSibling?.textContent).toBe(
      "Command",
    );
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
          metadata: {
            command: "pnpm test",
            cwd: "/workspace",
            status: "completed",
            exitCode: "0",
          },
        }}
      />,
    );

    expect(screen.getByText("Command")).toBeTruthy();
    expect(screen.getByText("pnpm test")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.queryByTestId("command-execution-diagnostics")).toBeNull();
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
          metadata: {
            command: "pnpm test",
            cwd: "/workspace",
            status: "completed",
            exitCode: "0",
          },
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
    expect(result.className).toContain("max-h-96");
    expect(result.className).toContain("overflow-y-auto");
    expect(command.className).not.toContain("bg-neutral");
    expect(screen.queryByText("/workspace")).toBeNull();
    expect(screen.getByRole("img", { name: "Command completed" })).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Command").closest("summary")?.className).toContain(
      "min-h-0",
    );
    expect(screen.getByText("Command").closest("summary")?.className).toContain(
      "py-0.5",
    );
    expect(screen.queryByTestId("command-execution-diagnostics")).toBeNull();
    expect(screen.queryByText("status", { exact: true })).toBeNull();
    expect(screen.queryByText("exit code", { exact: true })).toBeNull();
    expect(screen.queryByText("command", { exact: true })).toBeNull();
    expect(screen.queryByText("result", { exact: true })).toBeNull();
  });

  it("keeps a visible non-zero exit code with an error icon", () => {
    render(
      <ActivityItem
        item={{
          id: "command-failed-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "failed",
          metadata: {
            command: "pnpm test",
            status: "failed",
            exitCode: "1",
          },
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Command failed" })).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Command exited with code 1",
      }),
    ).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByTestId("command-execution-diagnostics")).toBeNull();
    expect(screen.queryByText("exit code", { exact: true })).toBeNull();
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

  it("renders an image preview for an explicit XLSX artifact", async () => {
    previewArtifact.mockResolvedValue({
      mimeType: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64,preview",
      format: "xlsx",
      sheets: 1,
      rows: 4,
      columns: 2,
    });

    render(
      <ActivityItem
        item={{
          id: "artifact-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Generate report",
          text: '{"ok":true}',
          artifactPath: "/workspace/report.xlsx",
          artifactFormat: "xlsx",
          metadata: { status: "completed" },
        }}
      />,
    );

    expect(
      await screen.findByRole("img", { name: "Artifact preview" }),
    ).toBeTruthy();
    expect(previewArtifact).toHaveBeenCalledWith("/workspace/report.xlsx");
  });

  it("accepts an injected artifact preview loader for browser stories", async () => {
    const loadArtifactPreview = vi.fn().mockResolvedValue({
      mimeType: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64,ladle-preview",
      format: "xlsx",
      sheets: 1,
      rows: 2,
      columns: 2,
    });

    render(
      <ActivityItem
        item={{
          id: "artifact-story-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Generate report",
          text: '{"ok":true}',
          artifactPath: "/workspace/report.xlsx",
          artifactFormat: "xlsx",
          metadata: { status: "completed" },
        }}
        loadArtifactPreview={loadArtifactPreview}
      />,
    );

    expect(
      await screen.findByRole("img", { name: "Artifact preview" }),
    ).toBeTruthy();
    expect(loadArtifactPreview).toHaveBeenCalledWith("/workspace/report.xlsx");
  });
});
