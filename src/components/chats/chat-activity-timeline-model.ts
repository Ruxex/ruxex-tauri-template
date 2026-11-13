import type { ConversationViewItem } from "../conversation/conversation-model";
import type { v2 } from "../../protocol";

export type ConversationTurnGroup = {
  turnId: string;
  items: ConversationViewItem[];
};

export function isVisibleTimelineItem(item: ConversationViewItem): boolean {
  return item.type !== "agentMessage" || item.text.trim().length > 0;
}

export function groupConversationItems(
  items: ConversationViewItem[],
): ConversationTurnGroup[] {
  const groups: ConversationTurnGroup[] = [];
  for (const item of items) {
    const current = groups.at(-1);
    if (current?.turnId === item.turnId) {
      current.items.push(item);
    } else {
      groups.push({ turnId: item.turnId, items: [item] });
    }
  }
  return groups;
}

export function findWorkingIndicatorInsertionIndex(
  items: ConversationViewItem[],
): number {
  const userMessageIndex = findLastIndex(
    items,
    (item) => item.type === "userMessage",
  );
  return userMessageIndex === -1 ? 0 : userMessageIndex + 1;
}

export function findLastIndex<T>(
  items: T[],
  predicate: (item: T) => boolean,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return index;
  }
  return -1;
}

export function getTurnDurationSeconds(turn: v2.Turn): number | null {
  if (turn.durationMs !== null && Number.isFinite(turn.durationMs)) {
    return Math.max(0, Math.floor(turn.durationMs / 1_000));
  }
  if (
    turn.startedAt !== null &&
    turn.completedAt !== null &&
    Number.isFinite(turn.startedAt) &&
    Number.isFinite(turn.completedAt)
  ) {
    return Math.max(0, Math.floor(turn.completedAt - turn.startedAt));
  }
  return null;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}
