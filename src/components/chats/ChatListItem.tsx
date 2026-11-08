import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useState } from "react";

import type { ChatStatus } from "./chat-status";
import { ChatTitle } from "./ChatTitle";
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
  unread?: boolean;
  showPreview?: boolean;
  onClick?: () => void;
  onArchive?: () => void;
  isArchiving?: boolean;
};

export function ChatListItem({
  thread,
  status,
  projectName,
  worktreeLabel,
  selected = false,
  unread = false,
  showPreview = false,
  onClick,
  onArchive,
  isArchiving = false,
}: ChatListItemProps) {
  const title = thread.name || thread.preview || "Untitled chat";
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  return (
    <div
      className={`group/thread grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-box border border-transparent p-0 transition hover:border-primary/50 hover:bg-base-200 ${selected ? "border-primary/30 bg-primary/10 ring-1 ring-inset ring-primary/30" : ""}`}
    >
      <Link
        className="block h-full w-full min-w-0 max-w-full overflow-hidden px-2 py-1"
        to={`/chat/${thread.id}`}
        onClick={onClick}
        onMouseEnter={() => setIsTitleHovered(true)}
        onMouseLeave={() => setIsTitleHovered(false)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {unread && (
            <span
              aria-label="Unread chat"
              className="size-2 shrink-0 rounded-full bg-primary"
              role="img"
            />
          )}
          {status && <ChatStatusIcon status={status} />}
          <ChatTitle isHovered={isTitleHovered} title={title} />
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
      {onArchive && (
        <button
          aria-label={`Archive ${title}`}
          className="btn btn-ghost btn-xs btn-square mt-1 mr-1 shrink-0 opacity-0 transition-opacity group-hover/thread:opacity-100 focus:opacity-100"
          disabled={isArchiving}
          title={`Archive ${title}`}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onArchive();
          }}
        >
          <ArchiveBoxIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
