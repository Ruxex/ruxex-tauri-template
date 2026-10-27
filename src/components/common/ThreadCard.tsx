import type { ReactNode } from "react";

import { useAppServerEvents } from "../../app-server/hooks";
import { TaskListItem } from "../tasks/TaskListItem";
import { taskStatusFromThreadStatus } from "../tasks/task-status";
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
};

export function ThreadCard({ thread, actions, compact = false }: ThreadCardProps) {
  const events = useAppServerEvents();
  const taskStatus = taskStatusFromThreadStatus(
    thread.status,
    events.threads[thread.id]?.status,
    Object.values(events.pendingServerRequests).some(
      (request) => request.threadId === thread.id,
    ),
  );

  if (compact) {
    return (
      <TaskListItem
        showPreview
        status={taskStatus}
        thread={thread}
      />
    );
  }

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm transition hover:border-primary">
      <div className="card-body gap-2 p-5">
        <TaskListItem
          showPreview
          status={taskStatus}
          thread={thread}
        />
        {actions && <div className="card-actions justify-end">{actions}</div>}
      </div>
    </article>
  );
}
