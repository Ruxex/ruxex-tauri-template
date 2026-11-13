import type {
  LiveConversationItem,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import {
  liveActivityTitle,
  normalizeThreadItem,
} from "./conversation-item-normalizer";
export { normalizeThreadItem } from "./conversation-item-normalizer";

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
  artifactPath?: string;
  artifactFormat?: string;
  editable?: boolean;
  timestamp?: number | null;
};

export function areConversationViewItemsEqual(
  left: ConversationViewItem,
  right: ConversationViewItem,
): boolean {
  return (
    left.id === right.id &&
    left.turnId === right.turnId &&
    left.type === right.type &&
    left.text === right.text &&
    left.category === right.category &&
    left.title === right.title &&
    left.imagePath === right.imagePath &&
    left.browserUrl === right.browserUrl &&
    left.artifactPath === right.artifactPath &&
    left.artifactFormat === right.artifactFormat &&
    left.editable === right.editable &&
    left.timestamp === right.timestamp &&
    areStringArraysEqual(left.imageUrls, right.imageUrls) &&
    areStringRecordsEqual(left.metadata, right.metadata)
  );
}

export function mergeConversationItems(
  authoritative: v2.ThreadItemsListResponse["data"],
  live: LiveConversationItem[],
  liveStatus?: ThreadExecutionState["status"],
  turns: v2.Turn[] = [],
  options: {
    preferAuthoritative?: boolean;
    assistantName?: string;
  } = {},
): ConversationViewItem[] {
  const assistantName = options.assistantName ?? "Assistant";
  const turnTimestamps = new Map(
    turns.map((turn) => [turn.id, turn.startedAt]),
  );
  const liveById = new Map(
    live.map((item) => [conversationItemKey(item.turnId, item.id), item]),
  );
  const seen = new Set<string>();
  const merged = authoritative.map(({ turnId, item }) => {
    const key = conversationItemKey(turnId, item.id);
    seen.add(key);
    const liveItem = liveById.get(key);
    const viewItem =
      liveItem && !options.preferAuthoritative
        ? liveItemToViewItem(liveItem, liveStatus, assistantName)
        : normalizeThreadItem(turnId, item, assistantName);
    const timestamp = turnTimestamps.get(turnId);
    return timestamp === undefined ? viewItem : { ...viewItem, timestamp };
  });

  for (const item of live) {
    const key = conversationItemKey(item.turnId, item.id);
    if (!seen.has(key)) {
      const viewItem = liveItemToViewItem(item, liveStatus, assistantName);
      const timestamp = turnTimestamps.get(item.turnId);
      merged.push(
        timestamp === undefined ? viewItem : { ...viewItem, timestamp },
      );
    }
  }
  return merged;
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
  assistantName = "Assistant",
): ConversationViewItem {
  if (item.raw) {
    const normalized = normalizeThreadItem(
      item.turnId,
      item.raw,
      assistantName,
    );
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
      title: assistantName,
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

function areStringArraysEqual(
  left: string[] | undefined,
  right: string[] | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  return Boolean(
    left &&
      right &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]),
  );
}

function areStringRecordsEqual(
  left: Record<string, string> | undefined,
  right: Record<string, string> | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right[key] === value)
  );
}
