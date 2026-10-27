import { Link } from "react-router-dom";

import {
  taskStatusClassName,
  taskStatusLabel,
  type TaskStatus,
} from "./task-status";

type TaskListThread = {
  id: string;
  name?: string | null;
  preview?: string | null;
  model?: string | null;
  updatedAt: number;
};

type TaskListItemProps = {
  thread: TaskListThread;
  status?: TaskStatus;
  projectName?: string;
  worktreeLabel?: string;
  selected?: boolean;
  showPreview?: boolean;
};

export function TaskListItem({
  thread,
  status,
  projectName,
  worktreeLabel,
  selected = false,
  showPreview = false,
}: TaskListItemProps) {
  const title = thread.name || thread.preview || "Untitled task";
  const statusLabel = status ? taskStatusLabel(status) : null;

  return (
    <Link
      className={`block min-w-0 rounded-box border border-transparent p-3 transition hover:border-primary/50 hover:bg-base-200 ${selected ? "bg-base-200" : ""}`}
      to={`/chat/${thread.id}`}
    >
      <span className="block min-w-0 truncate font-medium">{title}</span>
      {showPreview && thread.preview && thread.preview !== title && (
        <span className="mt-1 block line-clamp-2 text-sm text-base-content/70">
          {thread.preview}
        </span>
      )}
      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/60">
        {status && (
          <span
            aria-label={`Task status: ${statusLabel}`}
            className={`badge badge-sm ${taskStatusClassName(status)}`}
            role="status"
          >
            {statusLabel}
          </span>
        )}
        {projectName && <span className="truncate">{projectName}</span>}
        {worktreeLabel && <span className="truncate">{worktreeLabel}</span>}
        <span className="truncate">
          Updated {new Date(thread.updatedAt * 1000).toLocaleString()}
        </span>
      </span>
    </Link>
  );
}
