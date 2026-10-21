import { Link, NavLink } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { ThreadList } from "./ThreadList";

const PRIMARY_NAV_ITEMS = [
  { label: "Threads", compactLabel: "T", to: "/threads" },
  { label: "New chat", compactLabel: "+", to: "/chat/new" },
  { label: "Account", compactLabel: "A", to: "/account" },
  { label: "Approvals", compactLabel: "!", to: "/approvals" },
  { label: "Capabilities", compactLabel: "C", to: "/capabilities" },
  { label: "Settings", compactLabel: "S", to: "/settings" },
  { label: "Schedules", compactLabel: "R", to: "/schedules" },
] as const;

type ProjectSidebarProps = {
  collapsed: boolean;
  selectedProjectId?: string;
  selectedThreadId?: string;
  onToggle: () => void;
};

export function ProjectSidebar({
  collapsed,
  selectedProjectId,
  selectedThreadId,
  onToggle,
}: ProjectSidebarProps) {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <aside
      className={`workbench-sidebar shrink-0 border-r border-base-300 bg-base-100 p-4 ${collapsed ? "workbench-sidebar-collapsed" : "w-72"}`}
      aria-label="Project navigation"
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        {!collapsed && (
          <Link className="truncate text-lg font-semibold" to="/">
            Ruxex Desktop
          </Link>
        )}
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            aria-label={
              collapsed ? "Expand project sidebar" : "Collapse project sidebar"
            }
            onClick={onToggle}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
      </div>
      <nav aria-label="Primary navigation" className="mb-6">
        {!collapsed && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Navigation
          </p>
        )}
        <ul className="menu w-full gap-1 p-0">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                aria-label={item.label}
                className={({ isActive }) =>
                  `${isActive ? "active " : ""}${collapsed ? "justify-center px-2" : ""}`
                }
                title={collapsed ? item.label : undefined}
                to={item.to}
              >
                <span aria-hidden={collapsed}>
                  {collapsed ? item.compactLabel : item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {!collapsed && (
        <>
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Projects
              </p>
              <NavLink className="link link-primary text-xs" to="/threads">
                All
              </NavLink>
            </div>
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
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {selectedProjectId ? "Project chats" : "Recent chats"}
              </p>
              <Link className="link link-primary text-xs" to="/threads">
                Browse
              </Link>
            </div>
            <ThreadList
              projectId={selectedProjectId}
              selectedThreadId={selectedThreadId}
            />
          </div>
        </>
      )}
    </aside>
  );
}
