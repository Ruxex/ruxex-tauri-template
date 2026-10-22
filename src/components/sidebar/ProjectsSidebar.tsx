import { NavLink } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { SidebarHeader } from "./SidebarHeader";

export function ProjectsSidebar({
  onClose,
  selectedProjectId,
}: {
  onClose: () => void;
  selectedProjectId?: string;
}) {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <aside
      aria-label="Projects sidebar"
      className="flex h-full min-h-0 w-72 flex-col bg-base-100 p-4"
    >
      <SidebarHeader label="Projects" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {projects.isLoading && (
          <span className="loading loading-spinner loading-sm" />
        )}
        {projects.isError && (
          <p className="text-xs text-error">Unable to load projects.</p>
        )}
        <ul className="menu w-full gap-1 p-0">
          {projects.data?.data.map((project) => (
            <li key={project.id}>
              <NavLink
                className={
                  selectedProjectId === project.id ? "active" : undefined
                }
                to={`/projects/${project.id}`}
              >
                <span className="truncate">{project.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        {!projects.isLoading && !projects.data?.data.length && (
          <p className="text-xs text-base-content/60">No projects yet.</p>
        )}
      </div>
    </aside>
  );
}
