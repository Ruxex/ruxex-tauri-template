import { describe, expect, it } from "vitest";

import type { AppServerEvent } from "./events";
import { createInitialEventState, reduceAppServerEvent } from "./event-reducer";

const notification = (data: unknown): AppServerEvent => ({
  type: "serverNotification",
  data: data as AppServerEvent extends {
    type: "serverNotification";
    data: infer T;
  }
    ? T
    : never,
});

const serverRequest = (data: unknown): AppServerEvent => ({
  type: "serverRequest",
  data: data as AppServerEvent extends { type: "serverRequest"; data: infer T }
    ? T
    : never,
});

describe("reduceAppServerEvent", () => {
  it("clears reconnecting after a fresh server notification", () => {
    let state = reduceAppServerEvent(createInitialEventState(), {
      type: "disconnected",
      data: { message: "connection lost" },
    });

    state = reduceAppServerEvent(
      state,
      notification({
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "inProgress" },
        },
      }),
    );

    expect(state.resynchronizing).toBe(false);
    expect(state.threads["thread-1"]?.status).toBe("running");
  });

  it("accumulates agent message deltas in order and tracks the active turn", () => {
    let state = createInitialEventState();
    state = reduceAppServerEvent(
      state,
      notification({
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "inProgress" },
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "Hello",
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: " world",
        },
      }),
    );

    expect(state.threads["thread-1"]).toMatchObject({
      activeTurnId: "turn-1",
      status: "running",
      items: [
        {
          id: "item-1",
          type: "agentMessage",
          turnId: "turn-1",
          text: "Hello world",
        },
      ],
    });
  });

  it("keeps structured command items and their live output", () => {
    let state = reduceAppServerEvent(
      createInitialEventState(),
      notification({
        method: "item/started",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          startedAtMs: 1,
          item: {
            type: "commandExecution",
            id: "command-1",
            pluginId: null,
            scriptPath: null,
            command: "pnpm test",
            cwd: "/workspace",
            processId: null,
            source: "agent",
            status: "inProgress",
            commandActions: [],
            aggregatedOutput: null,
            exitCode: null,
            durationMs: null,
          },
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "command-1",
          delta: "running\n",
        },
      }),
    );

    expect(state.threads["thread-1"]?.items).toMatchObject([
      {
        id: "command-1",
        type: "commandExecution",
        text: "running\n",
        raw: { type: "commandExecution", command: "pnpm test" },
      },
    ]);
  });

  it("keeps plan, reasoning, file-change, and MCP progress deltas separate", () => {
    let state = createInitialEventState();
    const deltas = [
      ["item/plan/delta", "plan", "first plan step"],
      ["item/reasoning/textDelta", "reasoning", "checking the repository"],
      ["item/fileChange/outputDelta", "fileChange", "updated src/app.ts"],
      ["item/mcpToolCall/progress", "mcpToolCall", "waiting for tool"],
    ] as const;

    for (const [method, itemType, delta] of deltas) {
      state = reduceAppServerEvent(
        state,
        notification({
          method,
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            itemId: `item-${itemType}`,
            ...(method === "item/mcpToolCall/progress"
              ? { message: delta }
              : { delta }),
          },
        }),
      );
    }

    expect(state.threads["thread-1"]?.items).toMatchObject([
      { id: "item-plan", type: "plan", text: "first plan step" },
      {
        id: "item-reasoning",
        type: "reasoning",
        text: "checking the repository",
      },
      { id: "item-fileChange", type: "fileChange", text: "updated src/app.ts" },
      { id: "item-mcpToolCall", type: "mcpToolCall", text: "waiting for tool" },
    ]);
  });

  it("marks a turn completed while preserving its streamed items", () => {
    let state = createInitialEventState();
    state = reduceAppServerEvent(
      state,
      notification({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "done",
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "turn/completed",
        params: {
          threadId: "thread-1",
          turn: {
            id: "turn-1",
            status: "completed",
            items: [],
          },
        },
      }),
    );

    expect(state.threads["thread-1"]).toMatchObject({
      activeTurnId: null,
      status: "completed",
      completedTurn: { id: "turn-1", status: "completed" },
      items: [{ id: "item-1", text: "done" }],
    });
  });

  it("keeps approval requests keyed by request id until resolved", () => {
    let state = createInitialEventState();
    const request = serverRequest({
      method: "item/commandExecution/requestApproval",
      id: 42,
      params: {
        kind: "command",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        startedAtMs: 1,
        environmentId: null,
        command: "pnpm test",
      },
    });
    state = reduceAppServerEvent(state, request);

    expect(state.pendingServerRequests["42"]).toMatchObject({
      request: (request as Extract<AppServerEvent, { type: "serverRequest" }>)
        .data,
      requestId: 42,
      kind: "approval",
    });

    state = reduceAppServerEvent(
      state,
      notification({
        method: "serverRequest/resolved",
        params: { threadId: "thread-1", requestId: 42 },
      }),
    );

    expect(state.pendingServerRequests).toEqual({});
  });

  it.each([
    ["item/tool/requestUserInput", "userInput"],
    ["mcpServer/elicitation/request", "elicitation"],
    ["item/tool/call", "dynamicToolCall"],
    ["currentTime/read", "other"],
  ] as const)("classifies %s server requests as %s", (method, kind) => {
    const state = reduceAppServerEvent(
      createInitialEventState(),
      serverRequest({
        method,
        id: 100,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1" },
      }),
    );

    expect(state.pendingServerRequests["100"]).toMatchObject({
      kind,
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
    });
  });

  it("deduplicates an identical notification without losing ordered history", () => {
    const event = notification({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "once",
      },
    });
    let state = reduceAppServerEvent(createInitialEventState(), event);
    state = reduceAppServerEvent(state, event);

    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({
      id: expect.any(String),
      event,
    });
    expect(state.threads["thread-1"]?.items[0]?.text).toBe("once");
  });

  it("bounds seen event ids to the history capacity", () => {
    let state = createInitialEventState();

    for (let index = 0; index < 201; index += 1) {
      state = reduceAppServerEvent(
        state,
        notification({
          method: "future/notification",
          params: { sequence: index },
        }),
      );
    }

    expect(state.history).toHaveLength(200);
    expect(state.seenEventIds.size).toBe(200);
  });

  it("accepts an identity again after it leaves the deduplication window", () => {
    const oldest = notification({
      method: "future/notification",
      params: { sequence: 0 },
    });
    let state = reduceAppServerEvent(createInitialEventState(), oldest);

    for (let index = 1; index < 201; index += 1) {
      state = reduceAppServerEvent(
        state,
        notification({
          method: "future/notification",
          params: { sequence: index },
        }),
      );
    }

    const replayed = reduceAppServerEvent(state, oldest);

    expect(replayed).not.toBe(state);
    expect(replayed.history).toHaveLength(200);
    expect(replayed.history.at(-1)?.event).toEqual(oldest);
  });

  it("retains unknown notifications in history without inventing thread state", () => {
    const event = notification({
      method: "future/notification",
      params: { threadId: "thread-1", value: "opaque" },
    });

    const state = reduceAppServerEvent(createInitialEventState(), event);

    expect(state.history).toEqual([{ id: expect.any(String), event }]);
    expect(state.threads).toEqual({});
  });

  it("marks the state as resynchronizing after lagged or disconnected events", () => {
    let state = reduceAppServerEvent(createInitialEventState(), {
      type: "lagged",
      data: { skipped: 3 },
    });
    expect(state).toMatchObject({
      connected: true,
      resynchronizing: true,
      skippedEvents: 3,
    });

    state = reduceAppServerEvent(state, {
      type: "disconnected",
      data: { message: "socket closed" },
    });
    expect(state).toMatchObject({
      connected: false,
      resynchronizing: true,
      lastError: "socket closed",
    });
  });

  it.each([
    ["failed", "failed"],
    ["interrupted", "interrupted"],
  ] as const)(
    "maps a %s turn to its terminal thread status",
    (status, expectedStatus) => {
      const state = reduceAppServerEvent(
        createInitialEventState(),
        notification({
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: { id: "turn-1", status, items: [] },
          },
        }),
      );

      expect(state.threads["thread-1"]).toMatchObject({
        activeTurnId: null,
        status: expectedStatus,
      });
    },
  );

  it("marks active threads for resynchronization when the stream disconnects", () => {
    let state = reduceAppServerEvent(
      createInitialEventState(),
      notification({
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "inProgress" },
        },
      }),
    );

    state = reduceAppServerEvent(state, {
      type: "disconnected",
      data: { message: "connection reset" },
    });

    expect(state.threads["thread-1"]).toMatchObject({
      activeTurnId: "turn-1",
      status: "resynchronizing",
    });
  });

  it("updates a structured item in place when its completion arrives", () => {
    let state = reduceAppServerEvent(
      createInitialEventState(),
      notification({
        method: "item/started",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            type: "fileChange",
            id: "change-1",
            changes: [],
            status: "inProgress",
          },
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "item/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            type: "fileChange",
            id: "change-1",
            changes: [],
            status: "completed",
          },
        },
      }),
    );

    expect(state.threads["thread-1"]?.items).toHaveLength(1);
    expect(state.threads["thread-1"]?.items[0]?.raw).toMatchObject({
      type: "fileChange",
      status: "completed",
    });
  });

  it("resets a completed turn when a new turn starts", () => {
    let state = reduceAppServerEvent(
      createInitialEventState(),
      notification({
        method: "turn/completed",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "completed", items: [] },
        },
      }),
    );
    state = reduceAppServerEvent(
      state,
      notification({
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-2", status: "inProgress" },
        },
      }),
    );

    expect(state.threads["thread-1"]).toMatchObject({
      activeTurnId: "turn-2",
      status: "running",
      completedTurn: null,
    });
  });

  it("keeps only the most recent two hundred history entries", () => {
    let state = createInitialEventState();
    for (let index = 0; index < 205; index += 1) {
      state = reduceAppServerEvent(
        state,
        notification({
          method: "future/notification",
          params: { index },
        }),
      );
    }

    expect(state.history).toHaveLength(200);
    expect(state.history[0]?.event).toMatchObject({
      data: { params: { index: 5 } },
    });
  });

  it("accumulates skipped event counts across lag notifications", () => {
    let state = reduceAppServerEvent(createInitialEventState(), {
      type: "lagged",
      data: { skipped: 2 },
    });
    state = reduceAppServerEvent(state, {
      type: "lagged",
      data: { skipped: 4 },
    });

    expect(state.skippedEvents).toBe(6);
    expect(state.resynchronizing).toBe(true);
  });

  it("deduplicates server requests by request id even when the payload changes", () => {
    const first = serverRequest({
      method: "currentTime/read",
      id: 9,
      params: { request: "first" },
    });
    const second = serverRequest({
      method: "currentTime/read",
      id: 9,
      params: { request: "second" },
    });

    let state = reduceAppServerEvent(createInitialEventState(), first);
    state = reduceAppServerEvent(state, second);

    expect(state.history).toHaveLength(1);
    expect(state.pendingServerRequests["9"]?.request).toBe(
      (first as Extract<AppServerEvent, { type: "serverRequest" }>).data,
    );
  });
});
