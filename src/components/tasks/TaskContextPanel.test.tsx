// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskContextPanel } from "./TaskContextPanel";

const baseProps = {
  changedFiles: [],
  onClose: vi.fn(),
  onOpenContext: vi.fn(),
  onStartReview: vi.fn(),
  review: { error: null, isError: false, isPending: false, data: undefined },
  threadId: "thread-1",
  workspacePath: "/workspace/project",
};

describe("TaskContextPanel", () => {
  afterEach(cleanup);

  it("shows review context and lets users switch tabs", () => {
    const { rerender } = render(
      <TaskContextPanel
        {...baseProps}
        activeTab="review"
        branch="feature/task"
        changedFiles={[{ id: "file-1", text: "src/app.ts" }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Task context" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Review" })).toBeTruthy();
    expect(screen.getByText("src/app.ts")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Terminal" }));
    rerender(
      <TaskContextPanel
        {...baseProps}
        activeTab="terminal"
        branch="feature/task"
        changedFiles={[{ id: "file-1", text: "src/app.ts" }]}
      />,
    );
    expect(
      screen.getByText("Terminal is not supported in this build."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    rerender(
      <TaskContextPanel
        {...baseProps}
        activeTab="files"
        branch="feature/task"
        changedFiles={[{ id: "file-1", text: "src/app.ts" }]}
      />,
    );
    expect(
      screen.getByText("Files are not supported in this build."),
    ).toBeTruthy();
  });

  it("closes on Escape and the close action", () => {
    const onClose = vi.fn();
    render(
      <TaskContextPanel {...baseProps} activeTab="review" onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close task context" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
