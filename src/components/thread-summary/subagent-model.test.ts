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

  it("stops the running indicator when the child thread has completed", () => {
    const rows = buildSubagentRows(
      [thread({ status: { type: "idle" } })],
      { "child-1": live({ status: "completed" }) },
      [],
      undefined,
      {
        history: [
          {
            turnId: "parent-turn-1",
            item: {
              type: "subAgentActivity",
              id: "spawn-1",
              kind: "started",
              agentThreadId: "child-1",
              agentPath: "root/scout",
            },
          },
        ],
      },
    );

    expect(rows[0]?.status).toBe("done");
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

  it("uses the subagent thread name before the ID fallback", () => {
    const rows = buildSubagentRows(
      [
        thread({
          name: "Research helper",
          agentNickname: null,
          agentRole: null,
        }),
      ],
      {},
      [],
    );

    expect(rows[0]?.label).toBe("Research helper");
  });

  it("marks a child with a pending request as waiting for approval", () => {
    const rows = buildSubagentRows([thread()], {}, [pending("child-1")]);

    expect(rows[0]?.waitingForApproval).toBe(true);
  });

  it("adds a subagent found only in parent activity and keeps its activity label", () => {
    const rows = buildSubagentRows(
      [],
      {},
      [pending("activity-child")],
      undefined,
      {
        parentUpdatedAt: 500,
        history: [
          {
            turnId: "parent-turn",
            item: {
              type: "subAgentActivity",
              id: "activity-1",
              kind: "started",
              agentThreadId: "activity-child",
              agentPath: "root/workers/Researcher",
            },
          },
        ],
      },
    );

    expect(rows).toEqual([
      expect.objectContaining({
        threadId: "activity-child",
        label: "Researcher",
        status: "active",
        task: "",
        updatedAt: 500,
        waitingForApproval: true,
      }),
    ]);
  });

  it("uses spawn-agent task and per-agent results, including archived agents", () => {
    const spawn = {
      type: "collabAgentToolCall",
      id: "spawn-call",
      tool: "spawnAgent",
      status: "completed",
      senderThreadId: "parent-1",
      receiverThreadIds: [
        "active",
        "done",
        "failed",
        "interrupted",
        "archived",
      ],
      prompt: "Review this patch",
      model: null,
      reasoningEffort: null,
      agentsStates: {
        active: { status: "running" },
        done: { status: "completed" },
        failed: { status: "errored" },
        interrupted: { status: "shutdown" },
        archived: { status: "pendingInit" },
      },
    } as unknown as v2.ThreadItem;
    const rows = buildSubagentRows(
      [],
      { archived: live({ archived: true }) },
      [],
      undefined,
      {
        live: [
          { id: "live-spawn", turnId: "parent-turn", raw: spawn } as never,
        ],
      },
    );

    expect(
      rows.map(({ threadId, status, task }) => [threadId, status, task]),
    ).toEqual([
      ["active", "active", "Review this patch"],
      ["done", "done", "Review this patch"],
      ["failed", "failed", "Review this patch"],
      ["interrupted", "interrupted", "Review this patch"],
    ]);
  });

  it("keeps the latest status when an agent reports interaction", () => {
    const rows = buildSubagentRows([], {}, [], undefined, {
      history: [
        {
          turnId: "parent-turn",
          item: {
            type: "subAgentActivity",
            id: "started",
            kind: "started",
            agentThreadId: "child-1",
            agentPath: "root/child-1",
          },
        },
        {
          turnId: "parent-turn",
          item: {
            type: "subAgentActivity",
            id: "interacted",
            kind: "interacted",
            agentThreadId: "child-1",
            agentPath: "root/child-1",
          },
        },
      ],
    });

    expect(rows[0]).toMatchObject({ threadId: "child-1", status: "active" });
  });

  it("prefers a live agent summary and ignores blank trailing messages", () => {
    const liveState = live({
      items: [
        {
          id: "message-1",
          threadId: "child-1",
          turnId: "turn-1",
          type: "agentMessage",
          text: "Useful summary",
          raw: { type: "agentMessage" } as never,
        },
      ],
    });
    const rows = buildSubagentRows([thread()], { "child-1": liveState }, []);

    expect(rows[0]?.summary).toBe("Useful summary");
  });

  it("returns no summary when the latest agent message is blank", () => {
    const liveState = live({
      items: [
        {
          id: "message-1",
          threadId: "child-1",
          turnId: "turn-1",
          type: "agentMessage",
          text: "  ",
          raw: { type: "agentMessage" } as never,
        },
      ],
    });

    expect(
      buildSubagentRows([thread()], { "child-1": liveState }, [])[0]?.summary,
    ).toBeNull();
  });
});
