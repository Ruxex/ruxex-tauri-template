import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";

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
  onArchive?: () => void;
  isArchiving?: boolean;
};

export function ChatListItem({
  thread,
  status,
  projectName,
  worktreeLabel,
  selected = false,
  showPreview = false,
  onClick,
  onArchive,
  isArchiving = false,
}: ChatListItemProps) {
  const title = thread.name || thread.preview || "Untitled chat";
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  return (
    <div
      className={`group/thread grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-box border border-transparent p-0 transition hover:border-primary/50 hover:bg-base-200 ${selected ? "bg-base-200" : ""}`}
    >
      <Link
        className="block h-full w-full min-w-0 max-w-full overflow-hidden px-2 py-1"
        to={`/chat/${thread.id}`}
        onClick={onClick}
        onMouseEnter={() => setIsTitleHovered(true)}
        onMouseLeave={() => setIsTitleHovered(false)}
      >
        <span className="flex min-w-0 items-center gap-2">
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

function ChatTitle({
  isHovered,
  title,
}: {
  isHovered: boolean;
  title: string;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text || text.textContent !== title) return;
      setOverflowDistance(
        Math.max(0, text.scrollWidth - container.clientWidth),
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    if (textRef.current) observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [title]);

  const isOverflowing = overflowDistance > 0;
  const slideDurationMs = Math.max(4500, Math.round(overflowDistance * 37.5));

  return (
    <span
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap"
      data-title-overflowing={isOverflowing}
    >
      <span
        ref={textRef}
        className={`block truncate font-medium transition-opacity duration-200 ${isHovered && isOverflowing ? "opacity-0" : ""}`}
        data-title-text
      >
        {title}
      </span>
      {isOverflowing && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 whitespace-nowrap transition-transform ease-linear ${isHovered ? "opacity-100" : "opacity-0"}`}
          data-title-marquee
          style={{
            transform: `translateX(${isHovered ? -overflowDistance : 0}px)`,
            transitionDelay: isHovered ? "200ms" : "0ms",
            transitionDuration: `${slideDurationMs}ms`,
          }}
        >
          {title}
        </span>
      )}
    </span>
  );
}
