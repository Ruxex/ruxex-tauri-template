import { Fragment, memo } from "react";
import type { RefObject } from "react";

import type {
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { ServerRequestCard } from "../approvals/ServerRequestCard";
import {
  areConversationViewItemsEqual,
  type ConversationViewItem,
} from "../conversation/conversation-model";
import { useTimelineAutoScroll } from "./useTimelineAutoScroll";
import {
  findWorkingIndicatorInsertionIndex,
  formatDuration,
  getTurnDurationSeconds,
  groupConversationItems,
  isVisibleTimelineItem,
} from "./chat-activity-timeline-model";
import {
  CompletedTurnGroup,
  TimelineItem,
  WorkingIndicator,
} from "./TimelineActivityParts";
import { useWorkingSeconds } from "./useWorkingSeconds";

type ChatActivityTimelineProps = {
  connected: boolean;
  items: ConversationViewItem[];
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
                <TimelineItem
                  item={item}
                  isStreaming={showActiveHere && item.type === "agentMessage"}
                  onEdit={onEdit}
                />
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
    arePendingRequestsEqual(left.pendingRequests, right.pendingRequests)
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
