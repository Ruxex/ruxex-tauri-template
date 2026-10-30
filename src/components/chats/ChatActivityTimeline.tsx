import { Fragment, memo, useEffect, useState } from "react";

import type {
  LiveConversationItem,
  PendingServerRequest,
  ThreadExecutionState,
} from "../../app-server/event-reducer";
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
  workingTurnId?: string | null;
  workingStartedAt?: number | null;
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
  workingTurnId,
  workingStartedAt,
}: ChatActivityTimelineProps) {
  const timelineRef = useTimelineAutoScroll({ items, pendingRequests });
  const isBusy = liveStatus === "running" || liveStatus === "resynchronizing";
  const workingSeconds = useWorkingSeconds(isBusy ? workingStartedAt : null);
  const workingLabel =
    workingSeconds === null ? "Working" : `Working for ${workingSeconds}s`;
  const workingItemIndex = workingTurnId
    ? items.findIndex((item) => item.turnId === workingTurnId)
    : 0;
  const workingInsertionIndex = workingItemIndex < 0 ? 0 : workingItemIndex;

  return (
    <section
      aria-busy={isBusy}
      aria-label="Chat activity"
      className="space-y-4 bg-base-200 p-4"
      ref={timelineRef}
    >
      {items.length === 0 && isBusy && (
        <WorkingIndicator label={workingLabel} />
      )}
      {items.map((item, index) => (
        <Fragment key={`item:${item.turnId}:${item.id}`}>
          {isBusy && index === workingInsertionIndex && (
            <WorkingIndicator label={workingLabel} />
          )}
          {item.category === "message" ? (
            <ConversationItem item={item} onEdit={onEdit} />
          ) : (
            <ActivityItem item={item} />
          )}
        </Fragment>
      ))}
      {pendingRequests.map((pending) => (
        <ServerRequestCard
          connected={connected}
          key={`request:${String(pending.requestId)}`}
          onReject={(message) => onReject(pending.requestId, message)}
          onResolve={(result) => onResolve(pending.requestId, result)}
          pending={pending}
        />
      ))}
      {items.length === 0 && pendingRequests.length === 0 && !isBusy && (
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
    left.workingTurnId === right.workingTurnId &&
    left.workingStartedAt === right.workingStartedAt &&
    areConversationItemsEqual(left.items, right.items) &&
    areLiveItemsEqual(left.liveItems, right.liveItems) &&
    arePendingRequestsEqual(left.pendingRequests, right.pendingRequests)
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
  }, [hasValidStart, startedAt]);

  if (!hasValidStart || startedAt === undefined) {
    return null;
  }

  return Math.max(0, Math.floor(now / 1_000 - startedAt));
}

function WorkingIndicator({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="border-t border-base-300 pt-3 text-center text-sm text-base-content/60"
      role="status"
    >
      {label}
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
