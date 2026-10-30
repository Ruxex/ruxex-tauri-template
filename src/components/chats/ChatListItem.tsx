import { Link } from "react-router-dom";

import type { ChatStatus } from "./chat-status";
import { ChatStatusIcon } from "./ChatStatusIcon";

type ChatListThread = {
  id: string;
  name?: string | null;
  preview?: string | null;
  model?: string | null;
  updatedAt: number;
};

type ChatListItemProps = {
  thread: ChatListThread;
  status?: ChatStatus;
  projectName?: string;
  worktreeLabel?: string;
  selected?: boolean;
  showPreview?: boolean;
  onClick?: () => void;
};

export function ChatListItem({
  thread,
  status,
  projectName,
  worktreeLabel,
  selected = false,
  showPreview = false,
  onClick,
}: ChatListItemProps) {
  const title = thread.name || thread.preview || "Untitled chat";
  return (
    <Link
      className={`block min-w-0 rounded-box border border-transparent px-2 py-1 transition hover:border-primary/50 hover:bg-base-200 ${selected ? "bg-base-200" : ""}`}
      to={`/chat/${thread.id}`}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2">
        {status && <ChatStatusIcon status={status} />}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      </span>
      {showPreview && thread.preview && thread.preview !== title && (
        <span className="mt-1 block line-clamp-2 text-sm text-base-content/70">
          {thread.preview}
        </span>
      )}
      {(projectName || worktreeLabel) && (
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/60">
          {projectName && <span className="truncate">{projectName}</span>}
          {worktreeLabel && <span className="truncate">{worktreeLabel}</span>}
        </span>
      )}
    </Link>
  );
}
