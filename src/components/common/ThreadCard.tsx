import type { ReactNode } from "react";

import { useAppServerEvents } from "../../app-server/hooks";
import { ChatListItem } from "../chats/ChatListItem";
import { chatStatusFromThreadStatus } from "../chats/chat-status";
import type { v2 } from "../../protocol";

type ThreadSummary = {
  id: string;
  name: string | null;
  preview: string;
  model?: string | null;
  updatedAt: number;
  status?: v2.ThreadStatus;
};

type ThreadCardProps = {
  thread: ThreadSummary;
  actions?: ReactNode;
  compact?: boolean;
  showUpdatedAt?: boolean;
  onArchive?: () => void;
  isArchiving?: boolean;
};

export function ThreadCard({
  thread,
  actions,
  compact = false,
  showUpdatedAt = false,
  onArchive,
  isArchiving = false,
}: ThreadCardProps) {
  const events = useAppServerEvents();
  const chatStatus = chatStatusFromThreadStatus(
    thread.status,
    events.threads[thread.id]?.status,
    Object.values(events.pendingServerRequests).some(
      (request) => request.threadId === thread.id,
    ),
  );

  if (compact) {
    return (
      <ChatListItem
        showCardBoundary
        showPreview
        showUpdatedAt={showUpdatedAt}
        actions={actions}
        onArchive={onArchive}
        isArchiving={isArchiving}
        status={chatStatus}
        thread={thread}
      />
    );
  }

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm transition hover:border-primary">
      <div className="card-body gap-2 p-5">
        <ChatListItem
          showPreview
          showUpdatedAt={showUpdatedAt}
          actions={actions}
          onArchive={onArchive}
          isArchiving={isArchiving}
          status={chatStatus}
          thread={thread}
        />
      </div>
    </article>
  );
}
