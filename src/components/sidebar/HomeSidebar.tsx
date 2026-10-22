import { ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { SidebarHeader } from "./SidebarHeader";
import { ThreadList } from "./ThreadList";

export function HomeSidebar({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <aside
      aria-label="Home sidebar"
      className="flex h-full min-h-0 w-72 flex-col bg-base-100 p-4"
    >
      <SidebarHeader label="Home" onClose={onClose} />
      <Link className="btn btn-primary mb-6 w-full" to="/chat/new">
        <PlusIcon aria-hidden="true" className="size-4" />
        New chat
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <details className="group rounded-box" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200">
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open:rotate-90"
            />
            <span>Projects</span>
          </summary>
          <div className="space-y-1 pl-4 pt-1">
            {projects.isLoading && (
              <span className="loading loading-spinner loading-sm" />
            )}
            {projects.isError && (
              <p className="text-xs text-error">Unable to load projects.</p>
            )}
            {projects.data?.data.map((project) => (
              <details className="group rounded-box" key={project.id}>
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-sm hover:bg-base-200">
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform group-open:rotate-90"
                  />
                  <span className="truncate">{project.name}</span>
                </summary>
                <div className="pl-4 pt-1">
                  <ThreadList
                    projectId={project.id}
                    selectedThreadId={selectedThreadId}
                  />
                </div>
              </details>
            ))}
            {!projects.isLoading && !projects.data?.data.length && (
              <p className="text-xs text-base-content/60">No projects yet.</p>
            )}
          </div>
        </details>
        <details className="group mt-4 rounded-box" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200">
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open:rotate-90"
            />
            <span>Recent chats</span>
          </summary>
          <div className="pl-4 pt-1">
            <ThreadList selectedThreadId={selectedThreadId} />
          </div>
        </details>
      </div>
    </aside>
  );
}
