import { describe, expect, it } from "vitest";

import type {
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { buildSubagentRows } from "./subagent-model";

function thread(overrides: Partial<v2.Thread> = {}): v2.Thread {
  return {
    id: "child-1",
    environments: null,
    extra: null,
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: "parent-1",
    preview: "Inspect the API client",
    ephemeral: false,
    section: null,
    sectionEnteredAt: null,
    projectId: null,
    historyMode: "paginated",
    model: "test-model",
    reasoningEffort: null,
    createdAt: 100,
    updatedAt: 200,
    recencyAt: 200,
    status: { type: "idle" },
    path: null,
    cwd: "/workspace",
    cliVersion: "test",
    originator: null,
    source: "appServer",
    canAcceptDirectInput: true,
    threadSource: null,
    agentNickname: "API scout",
    agentRole: "researcher",
    gitInfo: null,
    name: null,
    daybreakEnabled: null,
    turns: [],
    ...overrides,
  };
}

function live(
  overrides: Partial<ThreadExecutionState> = {},
): ThreadExecutionState {
  return {
    threadId: "child-1",
    threadStatus: { type: "idle" },
    threadName: null,
    archived: false,
    historyChangedAt: null,
    queueChangedAt: null,
    activeTurnId: null,
    status: "idle",
    items: [],
    completedTurn: null,
    lastActivityAt: 200,
    ...overrides,
  };
}

function pending(threadId: string): PendingServerRequest {
  return {
    requestId: 1,
    kind: "approval",
    request: { method: "item/commandExecution/requestApproval", id: 1 },
    threadId,
    turnId: "turn-1",
    itemId: "item-1",
  } as PendingServerRequest;
}

describe("buildSubagentRows", () => {
  it("maps active and completed child threads into status rows", () => {
    const rows = buildSubagentRows(
      [
        thread({ id: "child-1", updatedAt: 200 }),
        thread({
          id: "child-2",
          preview: "Run the test suite",
          updatedAt: 300,
          agentNickname: "Test runner",
          agentRole: null,
        }),
      ],
      {
        "child-1": live({ status: "running", lastActivityAt: 250 }),
        "child-2": live({ status: "completed", lastActivityAt: 300 }),
      },
      [],
    );

    expect(rows.map((row) => [row.threadId, row.status])).toEqual([
      ["child-2", "done"],
      ["child-1", "active"],
    ]);
    expect(rows[0]?.task).toBe("Run the test suite");
  });

  it("falls back to a stable label and keeps failure status", () => {
    const rows = buildSubagentRows(
      [
        thread({
          id: "abcdef12-3456",
          agentNickname: null,
          agentRole: null,
        }),
      ],
      { "abcdef12-3456": live({ status: "failed" }) },
      [],
    );

    expect(rows[0]).toMatchObject({
      label: "Agent abcdef12",
      status: "failed",
      task: "Inspect the API client",
    });
  });

  it("marks a child with a pending request as waiting for approval", () => {
    const rows = buildSubagentRows([thread()], {}, [pending("child-1")]);

    expect(rows[0]?.waitingForApproval).toBe(true);
  });
});
