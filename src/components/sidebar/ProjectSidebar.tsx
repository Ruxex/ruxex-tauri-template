import { useNavigate } from "react-router-dom";

import { SidebarContextPanel } from "./RouteSidebar";
import {
  SIDEBAR_PANELS,
  type SidebarIcon,
  type SidebarPanel,
  type SidebarPanelDefinition,
} from "./navigation";

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
    void navigate(panel.route);
  }

  const primaryPanels = SIDEBAR_PANELS.filter(
    (panel) => panel.id !== "account" && panel.id !== "settings",
  );
  const secondaryPanels = SIDEBAR_PANELS.filter(
    (panel) => panel.id === "account" || panel.id === "settings",
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
          {secondaryPanels.map((panel) => (
            <RailButton
              active={activePanel === panel.id}
              key={panel.id}
              label={panel.label}
              icon={panel.icon}
              onClick={() => selectPanel(panel)}
            />
          ))}
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
