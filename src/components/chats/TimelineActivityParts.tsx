import { Fragment } from "react";

import { ActivityItem } from "../conversation/ActivityItem";
import { ConversationItem } from "../conversation/ConversationItem";
import type { ConversationViewItem } from "../conversation/conversation-model";
import {
  findLastIndex,
  formatDuration,
  getTurnDurationSeconds,
} from "./chat-activity-timeline-model";
import type { v2 } from "../../protocol";

export function TimelineItem({
  item,
  onEdit,
  isStreaming = false,
}: {
  item: ConversationViewItem;
  onEdit?: (
    item: ConversationViewItem,
    editedText: string,
  ) => void | Promise<void>;
  isStreaming?: boolean;
}) {
  return item.category === "message" ? (
    <ConversationItem isStreaming={isStreaming} item={item} onEdit={onEdit} />
  ) : (
    <ActivityItem item={item} />
  );
}

export function CompletedTurnGroup({
  items,
  onEdit,
  turn,
}: {
  items: ConversationViewItem[];
  onEdit?: (
    item: ConversationViewItem,
    editedText: string,
  ) => void | Promise<void>;
  turn: v2.Turn;
}) {
  const finalAssistantIndex = findLastIndex(
    items,
    (item) => item.type === "agentMessage" && item.text.trim().length > 0,
  );
  const userItems = items.filter((item) => item.type === "userMessage");
  const collapsedItems = items.filter(
    (item, index) =>
      item.type !== "userMessage" && index !== finalAssistantIndex,
  );
  const finalAssistant =
    finalAssistantIndex === -1 ? null : items[finalAssistantIndex];
  const workedSeconds = getTurnDurationSeconds(turn);
  const workedLabel =
    workedSeconds === null
      ? "Worked"
      : `Worked for ${formatDuration(workedSeconds)}`;

  return (
    <Fragment>
      {userItems.map((item) => (
        <Fragment key={`item:${item.turnId}:${item.id}`}>
          <TimelineItem item={item} onEdit={onEdit} />
        </Fragment>
      ))}
      {collapsedItems.length > 0 && (
        <details className="border-t border-base-300 pt-3 text-sm text-base-content/60">
          <summary className="cursor-pointer select-none text-left">
            {workedLabel}
          </summary>
          <div className="mt-3 space-y-0">
            {collapsedItems.map((item) => (
              <Fragment key={`item:${item.turnId}:${item.id}`}>
                <TimelineItem item={item} onEdit={onEdit} />
              </Fragment>
            ))}
          </div>
        </details>
      )}
      {finalAssistant && (
        <Fragment key={`item:${finalAssistant.turnId}:${finalAssistant.id}`}>
          <TimelineItem item={finalAssistant} onEdit={onEdit} />
        </Fragment>
      )}
    </Fragment>
  );
}

export function WorkingIndicator({
  active = false,
  empty = false,
  label,
}: {
  active?: boolean;
  empty?: boolean;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={
        empty
          ? "mx-auto flex max-w-md items-center justify-center gap-3 rounded-box border border-dashed border-primary/30 bg-base-100 px-5 py-6 text-center text-sm text-base-content/70 shadow-sm"
          : "border-t border-base-300 pt-3 text-left text-sm text-base-content/60"
      }
      role="status"
    >
      {active ? (
        <>
          <span
            aria-hidden="true"
            className="working-indicator-dots"
            data-testid="working-indicator-dots"
          >
            <span />
            <span />
            <span />
          </span>
          <span className="ml-2" data-testid="working-indicator-label">
            {label}
          </span>
        </>
      ) : (
        <span data-testid="working-indicator-label">{label}</span>
      )}
    </div>
  );
}
