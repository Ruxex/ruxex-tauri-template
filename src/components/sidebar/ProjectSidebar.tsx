import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import {
  SIDEBAR_PANELS,
  type SidebarIcon,
  type SidebarPanel,
  type SidebarPanelDefinition,
} from "./navigation";
import { SidebarContextPanel } from "./RouteSidebar";

type ProjectSidebarProps = {
  activePanel: SidebarPanel;
  collapsed: boolean;
  showContextPanel?: boolean;
  selectedThreadId?: string;
  onPanelChange: (panel: SidebarPanel) => void;
  onToggle: () => void;
};

export function ProjectSidebar({
  activePanel,
  collapsed,
  showContextPanel = true,
  selectedThreadId,
  onPanelChange,
  onToggle,
}: ProjectSidebarProps) {
  const { t } = useTranslation("navigation");
  const navigate = useNavigate();
  const location = useLocation();
  const contextPanelVisible = showContextPanel && !collapsed;

  function selectPanel(panel: SidebarPanelDefinition) {
    onPanelChange(panel.id);
    if (
      panel.id === "home" &&
      location.pathname.startsWith("/chat/") &&
      location.pathname !== "/chat/new"
    ) {
      return;
    }
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
      className={`workbench-sidebar relative flex h-full min-h-0 shrink-0 ${contextPanelVisible ? "w-full" : "workbench-sidebar-collapsed"}`}
      aria-label={t("navigation:workspaceSidebar")}
    >
      <nav
        aria-label={t("navigation:workspaceNavigation")}
        className="flex h-full min-h-0 w-16 shrink-0 flex-col items-center border-r border-base-300 bg-base-100 py-3"
      >
        <div className="flex w-full flex-col items-center gap-1">
          {primaryPanels.map((panel) => (
            <RailButton
              active={activePanel === panel.id}
              key={panel.id}
              label={t(`navigation:${panel.id}`)}
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
              label={t(`navigation:${panel.id}`)}
              icon={panel.icon}
              onClick={() => selectPanel(panel)}
            />
          ))}
        </div>
      </nav>
      {contextPanelVisible && (
        <SidebarContextPanel
          activePanel={activePanel}
          onClose={onToggle}
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
      className={`btn btn-ghost btn-square text-lg ${active ? "btn-active text-primary" : ""}`}
      title={label}
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
