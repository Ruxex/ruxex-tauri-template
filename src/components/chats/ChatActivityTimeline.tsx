import { Fragment, memo, useEffect, useState } from "react";
import type { RefObject } from "react";

import type {
  LiveConversationItem,
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { ServerRequestCard } from "../approvals/ServerRequestCard";
import { ActivityItem } from "../conversation/ActivityItem";
import { ConversationItem } from "../conversation/ConversationItem";
import {
  areConversationViewItemsEqual,
  type ConversationViewItem,
} from "../conversation/conversation-model";
import { useTimelineAutoScroll } from "./useTimelineAutoScroll";

type ChatActivityTimelineProps = {
  connected: boolean;
  items: ConversationViewItem[];
  liveItems: LiveConversationItem[];
  liveStatus?: ThreadExecutionState["status"];
  onEdit?: (
    item: ConversationViewItem,
    editedText: string,
  ) => void | Promise<void>;
  onReject: (
    requestId: PendingServerRequest["requestId"],
    message: string,
  ) => Promise<void>;
  onResolve: (
    requestId: PendingServerRequest["requestId"],
    result: unknown,
  ) => Promise<void>;
  pendingRequests: PendingServerRequest[];
  timelineRef?: RefObject<HTMLElement | null>;
  turns?: v2.Turn[];
  workingTurnId?: string | null;
  workingStartedAt?: number | null;
  completedTurn?: v2.Turn | null;
};

export const ChatActivityTimeline = memo(function ChatActivityTimeline({
  connected,
  items,
  liveItems: _liveItems,
  liveStatus,
  onEdit,
  onReject,
  onResolve,
  pendingRequests,
  timelineRef: suppliedTimelineRef,
  turns = [],
  workingTurnId,
  workingStartedAt,
  completedTurn,
}: ChatActivityTimelineProps) {
  const visibleItems = items.filter(isVisibleTimelineItem);
  const timelineRef = useTimelineAutoScroll({
    items: visibleItems,
    pendingRequests,
    timelineRef: suppliedTimelineRef,
  });
  const turnGroups = groupConversationItems(visibleItems);
  const completedTurns = new Map(
    turns
      .filter((turn) => turn.status === "completed")
      .map((turn) => [turn.id, turn]),
  );
  if (completedTurn?.status === "completed") {
    completedTurns.set(completedTurn.id, completedTurn);
  }
  const isBusy = liveStatus === "running" || liveStatus === "resynchronizing";
  const showActiveIndicator = isBusy && pendingRequests.length === 0;
  const showCompletedIndicator = !isBusy && completedTurn != null;
  const showTerminalIndicator =
    showCompletedIndicator && completedTurn?.status !== "completed";
  const workingSeconds = useWorkingSeconds(
    showActiveIndicator ? workingStartedAt : null,
  );
  const workingLabel =
    workingSeconds === null ? "Working" : `Working for ${workingSeconds}s`;
  const workedSeconds = completedTurn
    ? getTurnDurationSeconds(completedTurn)
    : null;
  const workedLabel =
    workedSeconds === null
      ? "Worked"
      : `Worked for ${formatDuration(workedSeconds)}`;
  const indicatorLabel = showActiveIndicator ? workingLabel : workedLabel;
  const indicatorTurnId = showActiveIndicator
    ? workingTurnId
    : (completedTurn?.id ?? null);
  const showIndicator = showActiveIndicator || showTerminalIndicator;

  return (
    <section
      aria-busy={isBusy}
      aria-label="Chat activity"
      className="space-y-0 bg-base-200 p-4"
      ref={timelineRef}
    >
      {visibleItems.length === 0 &&
        (showIndicator || showCompletedIndicator) && (
          <WorkingIndicator
            active={showActiveIndicator}
            empty
            label={indicatorLabel}
          />
        )}
      {turnGroups.map((group) => {
        const completedTurnForGroup = completedTurns.get(group.turnId);
        if (completedTurnForGroup) {
          return (
            <CompletedTurnGroup
              key={`turn:${group.turnId}`}
              onEdit={onEdit}
              turn={completedTurnForGroup}
              items={group.items}
            />
          );
        }

        const showActiveHere =
          showActiveIndicator &&
          group.turnId === (workingTurnId ?? turnGroups[0]?.turnId);
        const showTerminalHere =
          showTerminalIndicator && group.turnId === indicatorTurnId;
        const insertionIndex = showActiveHere
          ? findWorkingIndicatorInsertionIndex(group.items)
          : 0;

        return (
          <Fragment key={`turn:${group.turnId}`}>
            {showTerminalHere && (
              <WorkingIndicator active={false} label={indicatorLabel} />
            )}
            {showActiveHere && insertionIndex === 0 && (
              <WorkingIndicator active label={indicatorLabel} />
            )}
            {group.items.map((item, index) => (
              <Fragment key={`item:${item.turnId}:${item.id}`}>
                {renderConversationItem(
                  item,
                  onEdit,
                  showActiveHere && item.type === "agentMessage",
                )}
                {showActiveHere && index + 1 === insertionIndex && (
                  <WorkingIndicator active label={indicatorLabel} />
                )}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
      {pendingRequests.map((pending) => (
        <ServerRequestCard
          connected={connected}
          key={`request:${String(pending.requestId)}`}
          onReject={(message) => onReject(pending.requestId, message)}
          onResolve={(result) => onResolve(pending.requestId, result)}
          pending={pending}
        />
      ))}
      {visibleItems.length === 0 &&
        pendingRequests.length === 0 &&
        !isBusy &&
        !showCompletedIndicator &&
        !showIndicator && (
          <p className="py-12 text-center text-base-content/60">
            No activity yet.
          </p>
        )}
    </section>
  );
}, areChatActivityTimelinePropsEqual);

function isVisibleTimelineItem(item: ConversationViewItem): boolean {
  return item.type !== "agentMessage" || item.text.trim().length > 0;
}

function areChatActivityTimelinePropsEqual(
  left: ChatActivityTimelineProps,
  right: ChatActivityTimelineProps,
): boolean {
  return (
    left.connected === right.connected &&
    left.liveStatus === right.liveStatus &&
    left.onEdit === right.onEdit &&
    left.onReject === right.onReject &&
    left.onResolve === right.onResolve &&
    left.timelineRef === right.timelineRef &&
    left.workingTurnId === right.workingTurnId &&
    left.workingStartedAt === right.workingStartedAt &&
    left.completedTurn === right.completedTurn &&
    left.turns === right.turns &&
    areConversationItemsEqual(left.items, right.items) &&
    areLiveItemsEqual(left.liveItems, right.liveItems) &&
    arePendingRequestsEqual(left.pendingRequests, right.pendingRequests)
  );
}

type ConversationTurnGroup = {
  turnId: string;
  items: ConversationViewItem[];
};

function groupConversationItems(
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

function findWorkingIndicatorInsertionIndex(
  items: ConversationViewItem[],
): number {
  const userMessageIndex = findLastIndex(
    items,
    (item) => item.type === "userMessage",
  );
  return userMessageIndex === -1 ? 0 : userMessageIndex + 1;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) {
      return index;
    }
  }
  return -1;
}

function renderConversationItem(
  item: ConversationViewItem,
  onEdit?: ChatActivityTimelineProps["onEdit"],
  isStreaming = false,
) {
  return item.category === "message" ? (
    <ConversationItem
      isStreaming={isStreaming}
      item={item}
      onEdit={onEdit}
    />
  ) : (
    <ActivityItem item={item} />
  );
}

function CompletedTurnGroup({
  items,
  onEdit,
  turn,
}: {
  items: ConversationViewItem[];
  onEdit?: ChatActivityTimelineProps["onEdit"];
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
          {renderConversationItem(item, onEdit)}
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
                {renderConversationItem(item, onEdit)}
              </Fragment>
            ))}
          </div>
        </details>
      )}
      {finalAssistant && (
        <Fragment key={`item:${finalAssistant.turnId}:${finalAssistant.id}`}>
          {renderConversationItem(finalAssistant, onEdit)}
        </Fragment>
      )}
    </Fragment>
  );
}

function useWorkingSeconds(
  startedAt: number | null | undefined,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const hasValidStart = startedAt !== null && Number.isFinite(startedAt);

  useEffect(() => {
    if (!hasValidStart) {
      return;
    }

    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(intervalId);
  }, [hasValidStart]);

  if (!hasValidStart || startedAt === undefined) {
    return null;
  }

  return Math.max(0, Math.floor(now / 1_000 - startedAt));
}

function getTurnDurationSeconds(turn: v2.Turn): number | null {
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function WorkingIndicator({
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

function areConversationItemsEqual(
  left: ConversationViewItem[],
  right: ConversationViewItem[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((item, index) => {
        const other = right[index];
        return (
          other !== undefined && areConversationViewItemsEqual(item, other)
        );
      }))
  );
}

function areLiveItemsEqual(
  left: LiveConversationItem[],
  right: LiveConversationItem[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((item, index) => {
        const other = right[index];
        return (
          other !== undefined &&
          item.id === other.id &&
          item.threadId === other.threadId &&
          item.turnId === other.turnId &&
          item.type === other.type &&
          item.text === other.text &&
          item.raw === other.raw
        );
      }))
  );
}

function arePendingRequestsEqual(
  left: PendingServerRequest[],
  right: PendingServerRequest[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((request, index) => {
        const other = right[index];
        return (
          other !== undefined &&
          request.requestId === other.requestId &&
          request.threadId === other.threadId &&
          request.turnId === other.turnId &&
          request.itemId === other.itemId &&
          request.request === other.request
        );
      }))
  );
}
