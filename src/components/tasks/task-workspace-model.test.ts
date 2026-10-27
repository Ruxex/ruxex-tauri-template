import { describe, expect, it } from "vitest";

import type { ThreadExecutionState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { getTaskWorkspaceStatus } from "./task-workspace-model";

function thread(overrides: Partial<v2.Thread> = {}): v2.Thread {
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
    model: "provider-model",
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
    name: "Implement the workspace",
    daybreakEnabled: null,
    turns: [],
    ...overrides,
  };
}

function turn(status: v2.Turn["status"]): v2.Turn {
  return {
    id: "turn-1",
    items: [],
    itemsView: "full",
    status,
    error: null,
    startedAt: 1,
    completedAt: status === "inProgress" ? null : 2,
    durationMs: null,
  };
}

describe("task workspace model", () => {
  it.each([
    ["completed", "completed"],
    ["failed", "failed"],
    ["interrupted", "stopped"],
  ] as const)("maps the latest persisted turn %s to %s", (status, expected) => {
    expect(
      getTaskWorkspaceStatus({
        latestTurn: turn(status),
        pendingRequestCount: 0,
        reconnecting: false,
        thread: thread(),
      }).status,
    ).toBe(expected);
  });

  it("prefers live waiting state and pending requests over persisted status", () => {
    const liveThread = {
      activeTurnId: "turn-2",
      status: "running",
    } as ThreadExecutionState;

    expect(
      getTaskWorkspaceStatus({
        latestTurn: turn("completed"),
        liveThread,
        pendingRequestCount: 1,
        reconnecting: false,
        thread: thread(),
      }).status,
    ).toBe("waiting");
  });

  it("keeps the underlying status while reconnecting", () => {
    const result = getTaskWorkspaceStatus({
      latestTurn: turn("completed"),
      pendingRequestCount: 0,
      reconnecting: true,
      thread: thread(),
    });

    expect(result).toMatchObject({
      reconnecting: true,
      status: "completed",
    });
  });

  it("returns workspace context without exposing provider or model fields", () => {
    expect(
      getTaskWorkspaceStatus({
        latestTurn: null,
        pendingRequestCount: 0,
        projectRoots: ["/workspace/project", "/workspace/shared"],
        reconnecting: false,
        thread: thread(),
      }),
    ).toMatchObject({
      branch: "feature/task",
      projectRoot: "/workspace/project",
      projectRootCount: 2,
      workspacePath: "/workspace/project",
    });
  });
});
