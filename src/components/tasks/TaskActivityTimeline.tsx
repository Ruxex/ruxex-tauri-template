import type {
  PendingServerRequest,
  LiveConversationItem,
} from "../../app-server/event-reducer";
import { ServerRequestCard } from "../approvals/ServerRequestCard";
import { ActivityItem } from "../conversation/ActivityItem";
import { ConversationItem } from "../conversation/ConversationItem";
import type { ConversationViewItem } from "../conversation/conversation-model";

type TaskActivityTimelineProps = {
  connected: boolean;
  items: ConversationViewItem[];
  liveItems: LiveConversationItem[];
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
  onReject,
  onResolve,
  pendingRequests,
}: TaskActivityTimelineProps) {
  const isBusy = liveItems.length > 0;

  return (
    <section
      aria-busy={isBusy}
      aria-label="Task activity"
      className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-box border border-base-300 bg-base-200 p-4"
    >
      {pendingRequests.map((pending) => (
        <ServerRequestCard
          connected={connected}
          key={String(pending.requestId)}
          onReject={(message) => onReject(pending.requestId, message)}
          onResolve={(result) => onResolve(pending.requestId, result)}
          pending={pending}
        />
      ))}
      {items.map((item) =>
        item.category === "message" ? (
          <ConversationItem item={item} key={item.id} />
        ) : (
          <ActivityItem item={item} key={item.id} />
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
