import type { v2 } from "../../protocol";
import type { LiveConversationItem } from "../../app-server/event-reducer";

export type ConversationViewItem = {
  id: string;
  turnId: string;
  type: string;
  text: string;
  category: "message" | "activity";
  title: string;
  metadata?: Record<string, string>;
};

export function mergeConversationItems(
  authoritative: v2.ThreadItemsListResponse["data"],
  live: LiveConversationItem[],
): ConversationViewItem[] {
  const liveById = new Map(live.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged = authoritative.map(({ turnId, item }) => {
    seen.add(item.id);
    const liveItem = liveById.get(item.id);
    return liveItem
      ? liveItemToViewItem(liveItem)
      : normalizeThreadItem(turnId, item);
  });

  for (const item of live) {
    if (!seen.has(item.id)) {
      merged.push(liveItemToViewItem(item));
    }
  }
  return merged;
}

export function normalizeThreadItem(
  turnId: string,
  item: v2.ThreadItem,
): ConversationViewItem {
  switch (item.type) {
    case "userMessage":
      return {
        id: item.id,
        turnId,
        type: item.type,
        category: "message",
        title: "You",
        text: item.content
          .filter((content) => content.type === "text")
          .map((content) => content.text)
          .join("\n"),
      };
    case "agentMessage":
      return {
        id: item.id,
        turnId,
        type: item.type,
        category: "message",
        title: "Ruxex",
        text: item.text,
      };
    case "plan":
      return messageActivity(item.id, turnId, item.type, "Plan", item.text);
    case "reasoning":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        "Reasoning",
        [...item.summary, ...item.content].join("\n"),
      );
    case "commandExecution":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        "Command",
        item.aggregatedOutput || item.command,
        compactMetadata({
          command: item.command,
          cwd: item.cwd,
          status: item.status,
          exitCode: item.exitCode,
        }),
      );
    case "fileChange":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        "Changes",
        item.changes.length > 0
          ? item.changes.map((change) => JSON.stringify(change)).join("\n")
          : "No file changes recorded.",
        compactMetadata({ status: item.status, files: item.changes.length }),
      );
    case "mcpToolCall":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        `MCP: ${item.server} / ${item.tool}`,
        item.error ? JSON.stringify(item.error) : item.result ? JSON.stringify(item.result) : "Tool call completed.",
        compactMetadata({
          server: item.server,
          tool: item.tool,
          status: item.status,
        }),
      );
    case "collabAgentToolCall":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        "Agent collaboration",
        item.prompt || `Tool: ${item.tool}`,
        compactMetadata({
          tool: item.tool,
          status: item.status,
          agents: item.receiverThreadIds.length,
        }),
      );
    default:
      return messageActivity(
        item.id,
        turnId,
        item.type,
        "Activity",
        safeJson(item),
      );
  }
}

export function buildUserTextInput(text: string): v2.UserInput {
  return { type: "text", text, text_elements: [] };
}

export function canSteerTurn(activeTurnId: string | null): boolean {
  return Boolean(activeTurnId);
}

function liveItemToViewItem(item: LiveConversationItem): ConversationViewItem {
  if (item.raw) {
    const normalized = normalizeThreadItem(item.turnId, item.raw);
    return item.text ? { ...normalized, text: item.text } : normalized;
  }

  const isMessage = item.type === "agentMessage";
  return {
    id: item.id,
    turnId: item.turnId,
    type: item.type,
    category: isMessage ? "message" : "activity",
    title: item.type === "agentMessage" ? "Ruxex" : item.type === "plan" ? "Plan" : "Reasoning",
    text: item.text,
  };
}

function messageActivity(
  id: string,
  turnId: string,
  type: string,
  title: string,
  text: string,
  metadata?: Record<string, string>,
): ConversationViewItem {
  return { id, turnId, type, category: "activity", title, text, metadata };
}

function compactMetadata(values: Record<string, string | number | null>): Record<string, string> | undefined {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== "");
  return entries.length > 0 ? Object.fromEntries(entries.map(([key, value]) => [key, String(value)])) : undefined;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "This activity cannot be previewed.";
  }
}
