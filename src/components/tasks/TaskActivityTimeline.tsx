import { useLayoutEffect, useRef } from "react";

import type {
  PendingServerRequest,
  LiveConversationItem,
} from "../../app-server/event-reducer";
import type { ThreadExecutionState } from "../../app-server/event-reducer";
import { ServerRequestCard } from "../approvals/ServerRequestCard";
import { ActivityItem } from "../conversation/ActivityItem";
import { ConversationItem } from "../conversation/ConversationItem";
import type { ConversationViewItem } from "../conversation/conversation-model";

const BOTTOM_TOLERANCE_PX = 24;

type TaskActivityTimelineProps = {
  connected: boolean;
  items: ConversationViewItem[];
  liveItems: LiveConversationItem[];
  liveStatus?: ThreadExecutionState["status"];
  onReject: (
    requestId: PendingServerRequest["requestId"],
    message: string,
  ) => Promise<void>;
  onResolve: (
    requestId: PendingServerRequest["requestId"],
    result: unknown,
  ) => Promise<void>;
  pendingRequests: PendingServerRequest[];
};

export function TaskActivityTimeline({
  connected,
  items,
  liveItems,
  liveStatus,
  onReject,
  onResolve,
  pendingRequests,
}: TaskActivityTimelineProps) {
  const timelineRef = useRef<HTMLElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const previousItemKeysRef = useRef<Set<string> | null>(null);
  const previousContentSignatureRef = useRef<string | null>(null);
  const isBusy =
    liveItems.length > 0 &&
    (liveStatus === "running" || liveStatus === "resynchronizing");
  const itemKeys = items.map((item) => `${item.turnId}:${item.id}`);
  const contentSignature = [
    ...items.map(
      (item) => `${item.turnId}:${item.id}:${item.type}:${item.text}`,
    ),
    ...pendingRequests.map((request) => `request:${String(request.requestId)}`),
  ].join("\u0000");

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }

    const updateBottomState = () => {
      wasAtBottomRef.current =
        timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight <=
        BOTTOM_TOLERANCE_PX;
    };

    updateBottomState();
    timeline.addEventListener("scroll", updateBottomState);
    return () => timeline.removeEventListener("scroll", updateBottomState);
  }, []);

  useLayoutEffect(() => {
    const previousItemKeys = previousItemKeysRef.current;
    const previousContentSignature = previousContentSignatureRef.current;
    previousItemKeysRef.current = new Set(itemKeys);
    previousContentSignatureRef.current = contentSignature;

    if (
      previousItemKeys === null ||
      previousContentSignature === contentSignature
    ) {
      return;
    }

    const addedUserMessage = items.some(
      (item) =>
        item.type === "userMessage" &&
        !previousItemKeys.has(`${item.turnId}:${item.id}`),
    );
    if (!addedUserMessage && !wasAtBottomRef.current) {
      return;
    }

    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    if (typeof timeline.scrollTo === "function") {
      timeline.scrollTo({ behavior: "smooth", top: timeline.scrollHeight });
    } else {
      timeline.scrollTop = timeline.scrollHeight;
    }
    wasAtBottomRef.current = true;
  }, [contentSignature, itemKeys, items]);

  return (
    <section
      aria-busy={isBusy}
      aria-label="Task activity"
      className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-box border border-base-300 bg-base-200 p-4"
      ref={timelineRef}
    >
      {pendingRequests.map((pending) => (
        <ServerRequestCard
          connected={connected}
          key={`request:${String(pending.requestId)}`}
          onReject={(message) => onReject(pending.requestId, message)}
          onResolve={(result) => onResolve(pending.requestId, result)}
          pending={pending}
        />
      ))}
      {items.map((item) =>
        item.category === "message" ? (
          <ConversationItem
            item={item}
            key={`item:${item.turnId}:${item.id}`}
          />
        ) : (
          <ActivityItem item={item} key={`item:${item.turnId}:${item.id}`} />
        ),
      )}
      {items.length === 0 && pendingRequests.length === 0 && (
        <p className="py-12 text-center text-base-content/60">
          No activity yet.
        </p>
      )}
    </section>
  );
}
