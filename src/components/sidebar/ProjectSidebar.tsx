import type { ComponentType, SVGProps } from "react";
import {
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useProjectList } from "../../app-server/hooks";
import { ThreadList } from "./ThreadList";

export type SidebarPanel =
  | "chats"
  | "new-chat"
  | "approvals"
  | "capabilities"
  | "schedules"
  | "settings";

type SidebarIcon = ComponentType<SVGProps<SVGSVGElement>>;

type SidebarPanelDefinition = {
  id: SidebarPanel;
  label: string;
  icon: SidebarIcon;
  route?: string;
};

const SIDEBAR_PANELS: readonly SidebarPanelDefinition[] = [
  { id: "chats", label: "Chats", icon: ChatBubbleLeftRightIcon },
  { id: "new-chat", label: "New chat", icon: PlusIcon, route: "/chat/new" },
  {
    id: "approvals",
    label: "Approvals",
    icon: CheckIcon,
    route: "/approvals",
  },
  {
    id: "capabilities",
    label: "Capabilities",
    icon: SparklesIcon,
    route: "/capabilities",
  },
  { id: "schedules", label: "Schedules", icon: ClockIcon, route: "/schedules" },
  {
    id: "settings",
    label: "Settings",
    icon: Cog6ToothIcon,
    route: "/settings",
  },
];

type ProjectSidebarProps = {
  activePanel: SidebarPanel;
  collapsed: boolean;
  selectedProjectId?: string;
  selectedThreadId?: string;
  onPanelChange: (panel: SidebarPanel) => void;
  onToggle: () => void;
};

export function ProjectSidebar({
  activePanel,
  collapsed,
  selectedProjectId,
  selectedThreadId,
  onPanelChange,
  onToggle,
}: ProjectSidebarProps) {
  const navigate = useNavigate();

  function selectPanel(panel: SidebarPanelDefinition) {
    onPanelChange(panel.id);
    if (panel.route) {
      void navigate(panel.route);
    }
  }

  return (
    <aside
      className={`workbench-sidebar flex h-dvh min-h-0 shrink-0 ${collapsed ? "workbench-sidebar-collapsed" : "w-[22rem]"}`}
      aria-label="Workspace sidebar"
    >
      <nav
        aria-label="Workspace navigation"
        className="flex h-full min-h-0 w-16 shrink-0 flex-col items-center border-r border-base-300 bg-base-100 py-3"
      >
        <Link
          aria-label="Ruxex Desktop home"
          className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-content"
          to="/"
        >
          R
        </Link>
        <div className="flex w-full flex-col items-center gap-1">
          {SIDEBAR_PANELS.slice(0, -1).map((panel) => (
            <RailButton
              active={activePanel === panel.id}
              key={panel.id}
              label={panel.label}
              icon={panel.icon}
              onClick={() => selectPanel(panel)}
            />
          ))}
        </div>
        <div className="mt-auto">
          <RailButton
            active={activePanel === "settings"}
            label="Settings"
            icon={Cog6ToothIcon}
            onClick={() =>
              selectPanel(SIDEBAR_PANELS[SIDEBAR_PANELS.length - 1])
            }
          />
        </div>
      </nav>
      {!collapsed && (
        <SidebarContextPanel
          activePanel={activePanel}
          onClose={onToggle}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
        />
      )}
    </aside>
  );
}

function RailButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: SidebarIcon;
  label: string;
  onClick: () => void;
}) {
  const Icon = icon;

  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`btn btn-ghost btn-sm size-10 p-0 text-lg ${active ? "btn-active text-primary" : ""}`}
      title={label}
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}

function SidebarContextPanel({
  activePanel,
  onClose,
  selectedProjectId,
  selectedThreadId,
}: {
  activePanel: SidebarPanel;
  onClose: () => void;
  selectedProjectId?: string;
  selectedThreadId?: string;
}) {
  switch (activePanel) {
    case "chats":
      return (
        <ChatsSidebar
          onClose={onClose}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
        />
      );
    case "settings":
      return <SettingsSidebar onClose={onClose} />;
    default: {
      const panel = SIDEBAR_PANELS.find((item) => item.id === activePanel);
      if (!panel) {
        return null;
      }
      return <RouteSidebar panel={panel} onClose={onClose} />;
    }
  }
}

function SidebarHeader({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-2">
      <h2 className="truncate text-lg font-semibold">{label}</h2>
      <button
        aria-label="Close sidebar panel"
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

function ChatsSidebar({
  onClose,
  selectedProjectId,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedProjectId?: string;
  selectedThreadId?: string;
}) {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });

  return (
    <aside
      aria-label="Chats sidebar"
      className="flex h-full min-h-0 w-72 flex-col bg-base-100 p-4"
    >
      <SidebarHeader label="Chats" onClose={onClose} />
      <Link className="btn btn-primary mb-6 w-full" to="/chat/new">
        New chat
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto">
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
      </div>
    </aside>
  );
}

function SettingsSidebar({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label="Settings sidebar"
      className="h-full min-h-0 w-72 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Settings" onClose={onClose} />
      <nav aria-label="Settings sections" className="menu w-full gap-1 p-0">
        <li>
          <NavLink end to="/settings">
            General
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings/appearance">Appearance</NavLink>
        </li>
        <li>
          <NavLink to="/settings/account">Account</NavLink>
        </li>
      </nav>
    </aside>
  );
}

function RouteSidebar({
  onClose,
  panel,
}: {
  onClose: () => void;
  panel: SidebarPanelDefinition;
}) {
  return (
    <aside
      aria-label={`${panel.label} sidebar`}
      className="h-full min-h-0 w-72 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label={panel.label} onClose={onClose} />
      <div className="rounded-box bg-base-200 p-4 text-sm text-base-content/70">
        <p>Open {panel.label.toLowerCase()} in the workspace.</p>
        {panel.route && (
          <NavLink className="btn btn-primary btn-sm mt-4" to={panel.route}>
            Open {panel.label}
          </NavLink>
        )}
      </div>
    </aside>
  );
}
