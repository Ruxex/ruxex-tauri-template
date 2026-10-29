import type {
  PendingServerRequest,
  LiveConversationItem,
} from "../../app-server/event-reducer";
import type { ThreadExecutionState } from "../../app-server/event-reducer";
import { ServerRequestCard } from "../approvals/ServerRequestCard";
import { ActivityItem } from "../conversation/ActivityItem";
import { ConversationItem } from "../conversation/ConversationItem";
import type { ConversationViewItem } from "../conversation/conversation-model";
import { useTimelineAutoScroll } from "./useTimelineAutoScroll";

type TaskActivityTimelineProps = {
  chatFontSize?: number;
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
  chatFontSize,
  connected,
  items,
  liveItems,
  liveStatus,
  onReject,
  onResolve,
  pendingRequests,
}: TaskActivityTimelineProps) {
  const timelineRef = useTimelineAutoScroll({ items, pendingRequests });
  const isBusy =
    liveItems.length > 0 &&
    (liveStatus === "running" || liveStatus === "resynchronizing");

  return (
    <section
      aria-busy={isBusy}
      aria-label="Task activity"
      className="space-y-4 bg-base-200 p-4"
      data-chat-font-size={
        chatFontSize === undefined ? undefined : String(chatFontSize)
      }
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
