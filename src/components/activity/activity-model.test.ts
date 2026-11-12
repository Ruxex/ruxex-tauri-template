import { describe, expect, it } from "vitest";

import type { EventState, PendingServerRequest } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import {
  buildActivityEntries,
  filterActivityEntries,
} from "./activity-model";

function snapshot(overrides: Partial<EventState> = {}): EventState {
  return {
    connected: true,
    resynchronizing: false,
    skippedEvents: 0,
    lastError: null,
    history: [],
    pendingServerRequests: {},
    threads: {},
    seenEventIds: new Set(),
    eventSequence: 0,
    ...overrides,
  };
}

function pending(threadId: string): PendingServerRequest {
  return {
    requestId: "approval-1",
    kind: "approval",
    request: {
      method: "item/commandExecution/requestApproval",
      id: "approval-1",
      params: { command: "pnpm test" },
    },
    threadId,
    turnId: "turn-1",
    itemId: "item-1",
  } as PendingServerRequest;
}

function thread(
  id: string,
  overrides: Partial<v2.Thread> = {},
): v2.Thread {
  return {
    id,
    environments: null,
    extra: null,
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: null,
    preview: "Work on the task",
    ephemeral: false,
    section: null,
    sectionEnteredAt: null,
    projectId: null,
    historyMode: "paginated",
    model: null,
    reasoningEffort: null,
    createdAt: 1,
    updatedAt: 1,
    recencyAt: 1,
    status: { type: "idle" },
    path: null,
    cwd: "/workspace",
    cliVersion: "test",
    originator: null,
    source: "appServer",
    canAcceptDirectInput: true,
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: null,
    daybreakEnabled: null,
    turns: [],
    ...overrides,
  };
}

describe("activity model", () => {
  it("includes pending approvals and links them to inactive child threads", () => {
    const entries = buildActivityEntries(
      snapshot({
        pendingServerRequests: { "approval-1": pending("child-1") },
      }),
      [thread("child-1", { parentThreadId: "parent-1" })],
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: "approval-approval-1",
        kind: "approval",
        needsAction: true,
        threadId: "child-1",
      }),
    ]);
  });

  it("projects running and completed child activity newest first", () => {
    const entries = buildActivityEntries(
      snapshot({
        threads: {
          "child-running": {
            threadId: "child-running",
            threadStatus: null,
            threadName: "API scout",
            archived: false,
            historyChangedAt: null,
            queueChangedAt: null,
            activeTurnId: "turn-1",
            status: "running",
            items: [],
            completedTurn: null,
            lastActivityAt: 300,
          },
          "parent-done": {
            threadId: "parent-done",
            threadStatus: null,
            threadName: "Parent task",
            archived: false,
            historyChangedAt: null,
            queueChangedAt: null,
            activeTurnId: null,
            status: "completed",
            items: [],
            completedTurn: null,
            lastActivityAt: 200,
          },
        },
      }),
      [
        thread("child-running", {
          parentThreadId: "parent-done",
          agentNickname: "API scout",
        }),
        thread("parent-done", { name: "Parent task" }),
      ],
    );

    expect(entries.map((entry) => [entry.kind, entry.status])).toEqual([
      ["agent", "running"],
      ["thread", "completed"],
    ]);
    expect(filterActivityEntries(entries, "running")).toHaveLength(1);
    expect(filterActivityEntries(entries, "agents")[0]?.threadId).toBe(
      "child-running",
    );
    expect(filterActivityEntries(entries, "completed")[0]?.threadId).toBe(
      "parent-done",
    );
  });

  it("returns an empty list when the event store has no activity", () => {
    expect(buildActivityEntries(snapshot(), [])).toEqual([]);
  });
});
