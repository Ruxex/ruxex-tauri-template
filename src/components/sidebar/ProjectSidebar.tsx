import type { ComponentType, SVGProps } from "react";
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  InformationCircleIcon,
  PlusIcon,
  PuzzlePieceIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { usePluginList, useProjectList } from "../../app-server/hooks";
import { ThreadList } from "./ThreadList";

export type SidebarPanel =
  | "home"
  | "projects"
  | "plugins"
  | "automation"
  | "account"
  | "settings";

type SidebarIcon = ComponentType<SVGProps<SVGSVGElement>>;

type SidebarPanelDefinition = {
  id: SidebarPanel;
  label: string;
  icon: SidebarIcon;
  route?: string;
};

const SIDEBAR_PANELS: readonly SidebarPanelDefinition[] = [
  { id: "home", label: "Home", icon: HomeIcon, route: "/" },
  { id: "projects", label: "Projects", icon: FolderIcon, route: "/projects" },
  {
    id: "plugins",
    label: "Plugins",
    icon: PuzzlePieceIcon,
    route: "/capabilities",
  },
  {
    id: "automation",
    label: "Automation",
    icon: CalendarDaysIcon,
    route: "/schedules",
  },
  {
    id: "account",
    label: "Account",
    icon: UserCircleIcon,
    route: "/settings/account",
  },
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
  contextPanelHidden?: boolean;
  selectedProjectId?: string;
  selectedThreadId?: string;
  onPanelChange: (panel: SidebarPanel) => void;
  onToggle: () => void;
};

export function ProjectSidebar({
  activePanel,
  collapsed,
  contextPanelHidden = false,
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

  const primaryPanels = SIDEBAR_PANELS.filter(
    (panel) => panel.id !== "account" && panel.id !== "settings",
  );
  const accountPanel = SIDEBAR_PANELS.find((panel) => panel.id === "account");
  const settingsPanel = SIDEBAR_PANELS.find(
    (panel) => panel.id === "settings",
  );

  return (
    <aside
      className={`workbench-sidebar flex h-full min-h-0 shrink-0 ${collapsed || contextPanelHidden ? "workbench-sidebar-collapsed" : "w-[22rem]"}`}
      aria-label="Workspace sidebar"
    >
      <nav
        aria-label="Workspace navigation"
        className="flex h-full min-h-0 w-16 shrink-0 flex-col items-center border-r border-base-300 bg-base-100 py-3"
      >
        <div className="flex w-full flex-col items-center gap-1">
          {primaryPanels.map((panel) => (
            <RailButton
              active={activePanel === panel.id}
              key={panel.id}
              label={panel.label}
              icon={panel.icon}
              onClick={() => selectPanel(panel)}
            />
          ))}
        </div>
        <div
          className="mt-auto flex w-full flex-col items-center gap-1"
          data-testid="secondary-navigation"
        >
          {accountPanel && (
            <RailButton
              active={activePanel === accountPanel.id}
              label={accountPanel.label}
              icon={accountPanel.icon}
              onClick={() => selectPanel(accountPanel)}
            />
          )}
          {settingsPanel && (
            <RailButton
              active={activePanel === settingsPanel.id}
              label={settingsPanel.label}
              icon={settingsPanel.icon}
              onClick={() => selectPanel(settingsPanel)}
            />
          )}
        </div>
      </nav>
      {!collapsed && !contextPanelHidden && (
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
    case "home":
      return (
        <HomeSidebar
          onClose={onClose}
          selectedThreadId={selectedThreadId}
        />
      );
    case "projects":
      return <ProjectsSidebar onClose={onClose} selectedProjectId={selectedProjectId} />;
    case "plugins":
      return <PluginsSidebar onClose={onClose} />;
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
        <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function HomeSidebar({
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

function ProjectsSidebar({
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

function PluginsSidebar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const plugins = usePluginList();
  const installedPlugins =
    plugins.data?.marketplaces
      .flatMap((marketplace) => marketplace.plugins)
      .filter((plugin) => plugin.installed) ?? [];

  function selectTab(tab: "plugins" | "skills") {
    void navigate(tab === "plugins" ? "/capabilities" : "/capabilities?tab=skills");
  }

  return (
    <aside
      aria-label="Plugins sidebar"
      className="h-full min-h-0 w-72 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Plugins" onClose={onClose} />
      <nav aria-label="Plugin sections" className="menu w-full gap-1 p-0">
        <li>
          <button type="button" onClick={() => selectTab("plugins")}>
            <PuzzlePieceIcon aria-hidden="true" className="size-4" />
            Plugins
          </button>
        </li>
        <li>
          <button type="button" onClick={() => selectTab("skills")}>
            <SparklesIcon aria-hidden="true" className="size-4" />
            Skills
          </button>
        </li>
      </nav>
      <details className="group mt-5 rounded-box">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          <span>Installed</span>
        </summary>
        <div className="pl-4 pt-1">
          {plugins.isLoading && (
            <span className="loading loading-spinner loading-sm" />
          )}
          {plugins.isError && (
            <p className="px-3 py-2 text-xs text-error">
              Unable to load installed plugins.
            </p>
          )}
          {!plugins.isLoading && !installedPlugins.length && (
            <p className="px-3 py-2 text-xs text-base-content/60">
              No installed plugins.
            </p>
          )}
          {installedPlugins.length > 0 && (
            <ul className="menu w-full gap-1 p-0">
              {installedPlugins.map((plugin) => (
                <li key={plugin.id}>
                  <button
                    className="w-full justify-start"
                    type="button"
                    onClick={() => selectTab("plugins")}
                  >
                    <span className="truncate">
                      {plugin.interface?.displayName ?? plugin.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
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
            <InformationCircleIcon aria-hidden="true" className="size-4" />
            General
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings/appearance">
            <SparklesIcon aria-hidden="true" className="size-4" />
            Appearance
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings/models">
            <DocumentTextIcon aria-hidden="true" className="size-4" />
            Models
          </NavLink>
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
