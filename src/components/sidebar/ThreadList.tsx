import { useAppServerEvents, useThreadList } from "../../app-server/hooks";
import { projectThreadListParams } from "../../app-server/hooks/useProjects";
import { TaskListItem } from "../tasks/TaskListItem";
import { taskStatusFromThreadStatus } from "../tasks/task-status";

type ThreadListProps = {
  projectId?: string;
  selectedThreadId?: string;
  onSelect?: () => void;
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
  const events = useAppServerEvents();

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
    <ul className="menu w-full gap-1 p-0">
      {threads.data.data.map((thread) => (
        <li key={thread.id}>
          <TaskListItem
            selected={selectedThreadId === thread.id}
            status={taskStatusFromThreadStatus(
              thread.status,
              events.threads[thread.id]?.status,
              Object.values(events.pendingServerRequests).some(
                (request) => request.threadId === thread.id,
              ),
            )}
            thread={thread}
            onClick={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
