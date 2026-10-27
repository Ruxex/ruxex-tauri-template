import {
  Cog6ToothIcon,
  FolderIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { ThreadList } from "../sidebar/ThreadList";

export function TaskSidebarSections({
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
    <nav
      aria-label="Task navigation"
      className="flex min-h-0 flex-1 flex-col"
    >
      <Link
        className="btn btn-primary mb-5 w-full"
        to="/chat/new"
        onClick={onClose}
      >
        <PlusIcon aria-hidden="true" className="size-4" />
        New task
      </Link>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <section aria-labelledby="recent-tasks-heading">
          <h3
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="recent-tasks-heading"
          >
            Recent tasks
          </h3>
          <div className="pl-1">
            <ThreadList
              onSelect={onClose}
              selectedThreadId={selectedThreadId}
            />
          </div>
        </section>

        <section aria-labelledby="projects-heading">
          <h3
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="projects-heading"
          >
            Projects
          </h3>
          <div className="menu w-full gap-1 p-0">
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
        </section>
      </div>

      <div className="mt-4 border-t border-base-300 pt-3">
        <Link
          className="btn btn-ghost w-full justify-start"
          to="/settings"
          onClick={onClose}
        >
          <Cog6ToothIcon aria-hidden="true" className="size-4" />
          Settings
        </Link>
      </div>
    </nav>
  );
}
