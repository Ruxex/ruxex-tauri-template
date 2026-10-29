import type { v2 } from "../../protocol";
import type {
  LiveConversationItem,
  ThreadExecutionState,
} from "../../app-server/event-reducer";

export type ConversationViewItem = {
  id: string;
  turnId: string;
  type: string;
  text: string;
  category: "message" | "activity";
  title: string;
  metadata?: Record<string, string>;
  imagePath?: string;
  imageUrls?: string[];
  browserUrl?: string;
  editable?: boolean;
};

export function mergeConversationItems(
  authoritative: v2.ThreadItemsListResponse["data"],
  live: LiveConversationItem[],
  liveStatus?: ThreadExecutionState["status"],
): ConversationViewItem[] {
  const liveById = new Map(
    live.map((item) => [conversationItemKey(item.turnId, item.id), item]),
  );
  const seen = new Set<string>();
  const merged = authoritative.map(({ turnId, item }) => {
    const key = conversationItemKey(turnId, item.id);
    seen.add(key);
    const liveItem = liveById.get(key);
    return liveItem
      ? liveItemToViewItem(liveItem, liveStatus)
      : normalizeThreadItem(turnId, item);
  });

  for (const item of live) {
    const key = conversationItemKey(item.turnId, item.id);
    if (!seen.has(key)) {
      merged.push(liveItemToViewItem(item, liveStatus));
    }
  }
  return merged;
}

export function normalizeThreadItem(
  turnId: string,
  item: v2.ThreadItem,
): ConversationViewItem {
  switch (item.type) {
    case "userMessage": {
      const text = item.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n");
      return {
        id: item.id,
        turnId,
        type: item.type,
        category: "message",
        title: "You",
        text,
        editable:
          item.content.length > 0 &&
          item.content.every((content) => content.type === "text") &&
          text.trim().length > 0,
      };
    }
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
        item.error
          ? JSON.stringify(item.error)
          : item.result
            ? JSON.stringify(item.result)
            : "Tool call completed.",
        compactMetadata({
          server: item.server,
          tool: item.tool,
          status: item.status,
        }),
      );
    case "dynamicToolCall": {
      const imageUrls = (item.contentItems ?? []).flatMap((content) =>
        content.type === "inputImage" ? [content.imageUrl] : [],
      );
      const browserUrl = findHttpUrl(item.arguments);
      return {
        ...messageActivity(
          item.id,
          turnId,
          item.type,
          `Tool: ${item.tool}`,
          safeJson(item.arguments),
          compactMetadata({
            namespace: item.namespace,
            status: item.status,
            success: item.success === null ? null : String(item.success),
          }),
        ),
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
        ...(browserUrl ? { browserUrl } : {}),
      };
    }
    case "imageView":
      return {
        ...messageActivity(item.id, turnId, item.type, "Screenshot", item.path),
        imagePath: item.path,
      };
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

function liveItemToViewItem(
  item: LiveConversationItem,
  liveStatus?: ThreadExecutionState["status"],
): ConversationViewItem {
  if (item.raw) {
    const normalized = normalizeThreadItem(item.turnId, item.raw);
    const viewItem = item.text
      ? { ...normalized, text: item.text }
      : normalized;
    return normalizeLiveActivityStatus(viewItem, liveStatus);
  }

  const isMessage = item.type === "agentMessage";
  if (isMessage) {
    return {
      id: item.id,
      turnId: item.turnId,
      type: item.type,
      category: "message",
      title: "Ruxex",
      text: item.text,
    };
  }

  return {
    id: item.id,
    turnId: item.turnId,
    type: item.type,
    category: "activity",
    title: liveActivityTitle(item.type),
    text: item.text,
    metadata: { status: activityStatusForLiveStatus(liveStatus) },
  };
}

function conversationItemKey(turnId: string, itemId: string): string {
  return `${turnId}:${itemId}`;
}

function normalizeLiveActivityStatus(
  item: ConversationViewItem,
  liveStatus?: ThreadExecutionState["status"],
): ConversationViewItem {
  if (
    !item.metadata ||
    !["inProgress", "running"].includes(item.metadata.status) ||
    liveStatus === undefined ||
    liveStatus === "running" ||
    liveStatus === "resynchronizing"
  ) {
    return item;
  }

  return {
    ...item,
    metadata: {
      ...item.metadata,
      status: activityStatusForLiveStatus(liveStatus),
    },
  };
}

function activityStatusForLiveStatus(
  liveStatus?: ThreadExecutionState["status"],
): string {
  switch (liveStatus) {
    case "failed":
      return "failed";
    case "interrupted":
      return "interrupted";
    case "completed":
      return "completed";
    default:
      return "inProgress";
  }
}

function liveActivityTitle(type: string): string {
  switch (type) {
    case "commandExecution":
      return "Command";
    case "fileChange":
      return "Changes";
    case "mcpToolCall":
      return "MCP tool";
    case "dynamicToolCall":
      return "Tool";
    case "plan":
      return "Plan";
    case "reasoning":
      return "Reasoning";
    case "imageView":
      return "Screenshot";
    case "collabAgentToolCall":
      return "Agent collaboration";
    default:
      return "Activity";
  }
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

function compactMetadata(
  values: Record<string, string | number | null>,
): Record<string, string> | undefined {
  const entries = Object.entries(values).filter(
    ([, value]) => value !== null && value !== "",
  );
  return entries.length > 0
    ? Object.fromEntries(entries.map(([key, value]) => [key, String(value)]))
    : undefined;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "This activity cannot be previewed.";
  }
}

function findHttpUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    return value.map(findHttpUrl).find((url): url is string => Boolean(url));
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map(findHttpUrl)
      .find((url): url is string => Boolean(url));
  }
  return undefined;
}
