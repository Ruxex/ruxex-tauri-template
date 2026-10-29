import {
  ChevronRightIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { ThreadList } from "../sidebar/ThreadList";
import { ChatSearchDialog } from "./ChatSearchDialog";

export function ChatSidebarSections({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <nav aria-label="Chat navigation" className="flex min-h-0 flex-1 flex-col">
      <Link className="btn btn-primary mb-5 w-full" to="/">
        <PlusIcon aria-hidden="true" className="size-4" />
        New chat
      </Link>
      <button
        className="btn btn-ghost mb-4 w-full justify-start"
        type="button"
        onClick={() => setSearchOpen(true)}
      >
        <MagnifyingGlassIcon aria-hidden="true" className="size-4" />
        Search chats
      </button>
      {searchOpen && (
        <ChatSearchDialog
          onClose={() => setSearchOpen(false)}
          onSelect={() => {
            setSearchOpen(false);
            onClose();
          }}
        />
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <details className="group rounded-box" open>
          <summary
            aria-controls="recent-chats-list"
            className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200"
            id="recent-chats-heading"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open:rotate-90"
            />
            <span>Recent chats</span>
          </summary>
          <div className="pl-1" id="recent-chats-list">
            <ThreadList selectedThreadId={selectedThreadId} />
          </div>
        </details>

        <details className="group rounded-box" open>
          <summary
            aria-controls="projects-list"
            className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200"
            id="projects-heading"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open:rotate-90"
            />
            <span>Projects</span>
          </summary>
          <div className="menu w-full gap-1 p-0" id="projects-list">
            {projects.isLoading && (
              <span className="loading loading-spinner loading-sm mx-3" />
            )}
            {projects.isError && (
              <p className="px-3 text-xs text-error">
                Unable to load projects.
              </p>
            )}
            {projects.data?.data.map((project) => (
              <li key={project.id}>
                <Link
                  className="truncate"
                  to={`/projects/${project.id}`}
                  onClick={onClose}
                >
                  <FolderIcon aria-hidden="true" className="size-4" />
                  {project.name}
                </Link>
              </li>
            ))}
            {!projects.isLoading && !projects.data?.data.length && (
              <p className="px-3 text-xs text-base-content/60">
                No projects yet.
              </p>
            )}
          </div>
        </details>
      </div>
    </nav>
  );
}
