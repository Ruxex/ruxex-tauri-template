import { describe, expect, it } from "vitest";

import type { LiveConversationItem } from "../../app-server/event-reducer";
import {
  buildUserTextInput,
  canSteerTurn,
  mergeConversationItems,
  normalizeThreadItem,
} from "./conversation-model";

describe("conversation workspace selectors", () => {
  it("renders authoritative transcript items and replaces a live streaming item by id", () => {
    const authoritative = [
      {
        turnId: "turn-1",
        item: { type: "agentMessage", id: "item-1", text: "Hello" },
      },
    ] as never;
    const live: LiveConversationItem[] = [
      {
        id: "item-1",
        threadId: "thread-1",
        turnId: "turn-1",
        type: "agentMessage",
        text: "Hello world",
      },
      {
        id: "item-2",
        threadId: "thread-1",
        turnId: "turn-1",
        type: "agentMessage",
        text: "Next item",
      },
    ];

    expect(mergeConversationItems(authoritative, live)).toEqual([
      {
        id: "item-1",
        turnId: "turn-1",
        type: "agentMessage",
        category: "message",
        title: "Ruxex",
        text: "Hello world",
      },
      {
        id: "item-2",
        turnId: "turn-1",
        type: "agentMessage",
        category: "message",
        title: "Ruxex",
        text: "Next item",
      },
    ]);
  });

  it("only exposes Stop/Steer actions when a turn is active", () => {
    expect(canSteerTurn("turn-1")).toBe(true);
    expect(canSteerTurn(null)).toBe(false);
  });

  it("builds the protocol text input used by normal send and steer", () => {
    expect(buildUserTextInput("Inspect this project")).toEqual({
      type: "text",
      text: "Inspect this project",
      text_elements: [],
    });
  });

  it("normalizes execution activity without losing diagnostic metadata", () => {
    const item = normalizeThreadItem("turn-2", {
      type: "commandExecution",
      id: "command-1",
      pluginId: null,
      scriptPath: null,
      command: "pnpm test",
      cwd: "/workspace",
      processId: null,
      source: "userShell",
      status: "completed",
      commandActions: [],
      aggregatedOutput: "1 test passed",
      exitCode: 0,
      durationMs: 1250,
    });

    expect(item).toMatchObject({
      id: "command-1",
      turnId: "turn-2",
      type: "commandExecution",
      category: "activity",
      title: "Command",
      text: "1 test passed",
      metadata: {
        command: "pnpm test",
        cwd: "/workspace",
        status: "completed",
        exitCode: "0",
      },
    });
  });

  it("keeps raw live tool progress labeled and marked in progress", () => {
    const items = mergeConversationItems(
      [],
      [
        {
          id: "mcp-progress-1",
          threadId: "thread-1",
          turnId: "turn-1",
          type: "mcpToolCall",
          text: "waiting for tool",
        },
      ],
    );

    expect(items[0]).toMatchObject({
      type: "mcpToolCall",
      category: "activity",
      title: "MCP tool",
      metadata: { status: "inProgress" },
    });
  });

  it("gives structured activities stable titles and useful summaries", () => {
    const fileChange = normalizeThreadItem("turn-3", {
      type: "fileChange",
      id: "change-1",
      changes: [],
      status: "completed",
    });
    const mcpCall = normalizeThreadItem("turn-3", {
      type: "mcpToolCall",
      id: "mcp-1",
      server: "docs",
      tool: "search",
      status: "completed",
      arguments: {},
      mcpAppUi: null,
      pluginId: null,
      readOnlyHint: null,
      result: null,
      error: null,
      durationMs: null,
    });
    const collaboration = normalizeThreadItem("turn-3", {
      type: "collabAgentToolCall",
      id: "collab-1",
      tool: "spawnAgent",
      status: "completed",
      senderThreadId: "turn-3",
      receiverThreadIds: ["thread-child"],
      prompt: "Inspect the failing test",
      model: null,
      reasoningEffort: null,
      agentsStates: {},
    });

    expect(fileChange).toMatchObject({
      type: "fileChange",
      title: "Changes",
      category: "activity",
    });
    expect(mcpCall).toMatchObject({
      type: "mcpToolCall",
      title: "MCP: docs / search",
      category: "activity",
    });
    expect(collaboration).toMatchObject({
      type: "collabAgentToolCall",
      title: "Agent collaboration",
      text: "Inspect the failing test",
      category: "activity",
    });
  });

  it("falls back safely for future server item variants", () => {
    const item = normalizeThreadItem("turn-4", {
      type: "futureActivity",
      id: "future-1",
      payload: { important: true },
    } as never);

    expect(item).toMatchObject({
      id: "future-1",
      turnId: "turn-4",
      type: "futureActivity",
      category: "activity",
      title: "Activity",
    });
    expect(item.text).toContain('"important":true');
  });
});
