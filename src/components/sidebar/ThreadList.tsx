import {
  activeThreadListParams,
  useArchiveThread,
  useThreadActivity,
  useThreadList,
} from "../../app-server/hooks";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useThreadReadState } from "../../app/thread-read-state";
import { projectThreadListParams } from "../../app-server/hooks/useProjects";
import type { v2 } from "../../protocol";
import { ChatListItem } from "../chats/ChatListItem";
import { chatStatusFromThreadStatus } from "../chats/chat-status";
import { EmptyState } from "../common/AsyncState";

type ThreadListProps = {
  projectId?: string;
  selectedThreadId?: string;
  onSelect?: () => void;
};

type ThreadListThread = {
  id: string;
  name?: string | null;
  preview?: string | null;
  model?: string | null;
  updatedAt: number;
  status?: v2.ThreadStatus;
};

export function ThreadList({
  projectId,
  selectedThreadId,
  onSelect,
}: ThreadListProps) {
  const threads = useThreadList(
    projectId ? projectThreadListParams(projectId) : activeThreadListParams(),
  );
  const archiveThread = useArchiveThread();
  if (threads.isLoading) {
    return <span className="loading loading-spinner loading-sm" />;
  }
  if (threads.isError) {
    return <p className="text-xs text-error">Unable to load chats.</p>;
  }
  if (!threads.data?.data.length) {
    return (
      <EmptyState
        description="Start a new chat to see it here."
        icon={ChatBubbleLeftRightIcon}
        title="No chats yet"
      />
    );
  }

  return (
    <ul className="menu w-full gap-0 p-0">
      {threads.data.data.map((thread) => (
        <ThreadListRow
          key={thread.id}
          onClick={onSelect}
          onArchive={() =>
            void archiveThread.mutateAsync({ threadId: thread.id })
          }
          isArchiving={archiveThread.isPending}
          selected={selectedThreadId === thread.id}
          thread={thread}
        />
      ))}
    </ul>
  );
}

function ThreadListRow({
  thread,
  selected,
  onClick,
  onArchive,
  isArchiving,
}: {
  thread: ThreadListThread;
  selected: boolean;
  onClick?: () => void;
  onArchive: () => void;
  isArchiving: boolean;
}) {
  const activity = useThreadActivity(thread.id);
  const { isThreadUnread } = useThreadReadState();

  return (
    <li>
      <ChatListItem
        selected={selected}
        status={chatStatusFromThreadStatus(
          thread.status,
          activity.status,
          activity.waitingForRequest,
        )}
        thread={thread}
        unread={isThreadUnread(thread.id, thread.updatedAt)}
        onClick={onClick}
        onArchive={onArchive}
        isArchiving={isArchiving}
      />
    </li>
  );
}
