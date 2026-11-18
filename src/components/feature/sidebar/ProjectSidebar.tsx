import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useAccount } from "@/app-server/hooks";
import { SIDEBAR_PANELS, type SidebarIcon, type SidebarPanel, type SidebarPanelDefinition } from "./navigation";
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
  const account = useAccount();
  const accountIsSignedOut = account.data?.authStatus === "unauthenticated";
  const contextPanelVisible = showContextPanel && !collapsed;

  function selectPanel(panel: SidebarPanelDefinition) {
    onPanelChange(panel.id);
    if (panel.id === "home" && location.pathname.startsWith("/chat/") && location.pathname !== "/chat/new") {
      return;
    }
    void navigate(panel.route);
  }

  const primaryPanels = SIDEBAR_PANELS.filter((panel) => panel.id !== "account" && panel.id !== "settings");
  const secondaryPanels = SIDEBAR_PANELS.filter((panel) => panel.id === "account" || panel.id === "settings");

  return (
    <aside
      className={`workbench-sidebar relative flex h-full min-h-0 shrink-0 ${contextPanelVisible ? "w-full" : "workbench-sidebar-collapsed"}`}
      aria-label={t("navigation:workspaceSidebar")}
    >
      <nav
        aria-label={t("navigation:workspaceNavigation")}
        className="flex h-full min-h-0 w-14 shrink-0 flex-col items-center border-r border-base-300 bg-base-100 py-3"
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
        <div className="mt-auto flex w-full flex-col items-center gap-1" data-testid="secondary-navigation">
          {secondaryPanels.map((panel) => (
            <RailButton
              active={activePanel === panel.id}
              key={panel.id}
              label={t(`navigation:${panel.id}`)}
              warning={panel.id === "account" && accountIsSignedOut}
              warningLabel={t("navigation:notSignedIn")}
              icon={panel.icon}
              onClick={() => selectPanel(panel)}
            />
          ))}
        </div>
      </nav>
      {contextPanelVisible && (
        <SidebarContextPanel activePanel={activePanel} onClose={onToggle} selectedThreadId={selectedThreadId} />
      )}
    </aside>
  );
}

function RailButton({
  active,
  icon,
  label,
  warning = false,
  warningLabel,
  onClick,
}: {
  active: boolean;
  icon: SidebarIcon;
  label: string;
  warning?: boolean;
  warningLabel?: string;
  onClick: () => void;
}) {
  const Icon = icon;
  const accessibleLabel = warning && warningLabel ? `${label}, ${warningLabel}` : label;
  const title = warning && warningLabel ? `${label} — ${warningLabel}` : label;

  return (
    <button
      aria-label={accessibleLabel}
      aria-pressed={active}
      className={`btn btn-ghost btn-square text-lg ${active ? "btn-active text-primary" : ""}`}
      title={title}
      type="button"
      onClick={onClick}
    >
      <span className="relative inline-flex">
        <Icon aria-hidden="true" className="size-5" />
        {warning && (
          <span className="absolute -bottom-1 -right-1 inline-flex size-3.5 items-center justify-center rounded-full bg-base-100 text-warning">
            <ExclamationTriangleIcon aria-hidden="true" className="size-3.5" />
          </span>
        )}
      </span>
    </button>
  );
}
