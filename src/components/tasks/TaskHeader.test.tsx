// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";
import { TaskHeader } from "./TaskHeader";

function makeThread(overrides: Partial<v2.Thread> = {}): v2.Thread {
  return {
    id: "thread-1",
    environments: null,
    extra: null,
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: null,
    preview: "Inspect the project",
    ephemeral: false,
    section: null,
    sectionEnteredAt: null,
    projectId: "project-1",
    historyMode: "paginated",
    model: "hidden-model",
    reasoningEffort: null,
    createdAt: 1,
    updatedAt: 2,
    recencyAt: 2,
    status: { type: "idle" },
    path: null,
    cwd: "/workspace/project",
    cliVersion: "0.1.0",
    originator: null,
    source: "appServer",
    canAcceptDirectInput: true,
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: { sha: "abc", branch: "feature/task", originUrl: null },
    name: "Build the workspace",
    daybreakEnabled: null,
    turns: [],
    ...overrides,
  };
}

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof TaskHeader>> = {},
) {
  return render(
    <TaskHeader
      latestTurn={null}
      liveThread={null}
      onResume={vi.fn()}
      onStartReview={vi.fn()}
      onStop={vi.fn()}
      pendingRequestCount={0}
      projectName="Ruxex"
      projectRoots={["/workspace/project"]}
      reconnecting={false}
      thread={makeThread()}
      {...overrides}
    />,
  );
}

describe("TaskHeader", () => {
  it("shows task context and actions without model/provider information", () => {
    const onStartReview = vi.fn();
    const onStop = vi.fn();
    renderHeader({
      liveThread: {
        activeTurnId: "turn-1",
        status: "running",
      } as never,
      onStartReview,
      onStop,
    });

    expect(
      screen.getByRole("heading", { name: "Build the workspace" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Task status: Running" }),
    ).toBeTruthy();
    expect(screen.getByText("Ruxex")).toBeTruthy();
    expect(screen.getByText("/workspace/project")).toBeTruthy();
    expect(screen.getByText("feature/task")).toBeTruthy();
    expect(screen.queryByText("hidden-model")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Stop task" }));
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(onStop).toHaveBeenCalledOnce();
    expect(onStartReview).toHaveBeenCalledOnce();
  });

  it("falls back to the preview and exposes Resume for an interrupted task", () => {
    const onResume = vi.fn();
    renderHeader({
      latestTurn: { status: "interrupted" } as never,
      onResume,
      thread: makeThread({ name: null }),
    });

    expect(
      screen.getByRole("heading", { name: "Inspect the project" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Task status: Stopped" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume task" }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("announces reconnecting and pending requests", () => {
    renderHeader({ pendingRequestCount: 2, reconnecting: true });

    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect(screen.getByText("2 pending requests")).toBeTruthy();
  });
});
