import {
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
  const [recentChatsOpen, setRecentChatsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <nav aria-label="Chat navigation" className="flex min-h-0 flex-1 flex-col">
      <Link className="btn btn-primary mb-5 w-full" to="/" onClick={onClose}>
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
        <section aria-labelledby="recent-chats-heading">
          <button
            aria-controls="recent-chats-list"
            aria-expanded={recentChatsOpen}
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="recent-chats-heading"
            onClick={() => setRecentChatsOpen((open) => !open)}
            type="button"
          >
            Recent chats
          </button>
          <div className="pl-1" id="recent-chats-list">
            {recentChatsOpen && (
              <ThreadList
                onSelect={onClose}
                selectedThreadId={selectedThreadId}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="projects-heading">
          <button
            aria-controls="projects-list"
            aria-expanded={projectsOpen}
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="projects-heading"
            onClick={() => setProjectsOpen((open) => !open)}
            type="button"
          >
            Projects
          </button>
          {projectsOpen && (
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
          )}
        </section>
      </div>
    </nav>
  );
}
