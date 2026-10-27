// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewWorkspace } from "./ReviewWorkspace";

const baseProps = {
  branch: "feature/task",
  changedFiles: [],
  onStartReview: vi.fn(),
  review: { error: null, isError: false, isPending: false, data: undefined },
  threadId: "thread-1",
  workspacePath: "/workspace/project",
};

describe("ReviewWorkspace", () => {
  afterEach(cleanup);

  it("shows review context and changed file metadata", () => {
    render(
      <ReviewWorkspace
        {...baseProps}
        changedFiles={[
          {
            id: "file-1",
            metadata: { files: "2", status: "completed" },
            text: "src/app.ts and src/app.test.ts",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Review" })).toBeTruthy();
    expect(screen.getByText("feature/task")).toBeTruthy();
    expect(screen.getByText("/workspace/project")).toBeTruthy();
    expect(screen.getByText("src/app.ts and src/app.test.ts")).toBeTruthy();
    expect(screen.getByText("Working tree status unavailable")).toBeTruthy();
  });

  it("renders clean and dirty worktree states when supplied", () => {
    const { rerender } = render(
      <ReviewWorkspace
        {...baseProps}
        worktree={{ clean: true, path: "/repo" }}
      />,
    );
    expect(screen.getByText("Clean worktree")).toBeTruthy();

    rerender(
      <ReviewWorkspace
        {...baseProps}
        worktree={{ clean: false, path: "/repo" }}
      />,
    );
    expect(screen.getByText("Dirty worktree")).toBeTruthy();
  });

  it("shows review progress, success, and failure states", () => {
    const { rerender } = render(
      <ReviewWorkspace
        {...baseProps}
        review={{ ...baseProps.review, isPending: true }}
      />,
    );
    expect(screen.getByText("Review is starting…")).toBeTruthy();

    rerender(
      <ReviewWorkspace
        {...baseProps}
        review={{ ...baseProps.review, data: { threadId: "review-1" } }}
      />,
    );
    expect(screen.getByText("Review started")).toBeTruthy();

    rerender(
      <ReviewWorkspace
        {...baseProps}
        review={{
          ...baseProps.review,
          error: new Error("Review unavailable"),
          isError: true,
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Review unavailable",
    );
  });
});
