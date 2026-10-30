import { useThreadActivity, useThreadList } from "../../app-server/hooks";
import { projectThreadListParams } from "../../app-server/hooks/useProjects";
import type { v2 } from "../../protocol";
import { ChatListItem } from "../chats/ChatListItem";
import { chatStatusFromThreadStatus } from "../chats/chat-status";

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
    projectId
      ? projectThreadListParams(projectId)
      : {
          archived: false,
          limit: 50,
          sortKey: "recency_at",
          sortDirection: "desc",
        },
  );
  if (threads.isLoading) {
    return <span className="loading loading-spinner loading-sm" />;
  }
  if (threads.isError) {
    return <p className="text-xs text-error">Unable to load chats.</p>;
  }
  if (!threads.data?.data.length) {
    return <p className="text-xs text-base-content/60">No chats yet.</p>;
  }

  return (
    <ul className="menu w-full gap-0 p-0">
      {threads.data.data.map((thread) => (
        <ThreadListRow
          key={thread.id}
          onClick={onSelect}
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
}: {
  thread: ThreadListThread;
  selected: boolean;
  onClick?: () => void;
}) {
  const activity = useThreadActivity(thread.id);

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
        onClick={onClick}
      />
    </li>
  );
}
