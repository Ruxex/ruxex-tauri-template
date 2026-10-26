import { NavLink } from "react-router-dom";

import { HomeSidebar } from "./HomeSidebar";
import {
  SIDEBAR_PANELS,
  type SidebarPanel,
  type SidebarPanelDefinition,
} from "./navigation";
import { PluginsSidebar } from "./PluginsSidebar";
import { SettingsSidebar } from "./SettingsSidebar";
import { SidebarHeader } from "./SidebarHeader";

export function SidebarContextPanel({
  activePanel,
  onClose,
  selectedThreadId,
}: {
  activePanel: SidebarPanel;
  onClose: () => void;
  selectedThreadId?: string;
}) {
  switch (activePanel) {
    case "home":
      return (
        <HomeSidebar onClose={onClose} selectedThreadId={selectedThreadId} />
      );
    case "plugins":
      return <PluginsSidebar onClose={onClose} />;
    case "settings":
      return <SettingsSidebar onClose={onClose} />;
    case "projects":
      return null;
    default: {
      const panel = SIDEBAR_PANELS.find((item) => item.id === activePanel);
      return panel ? <RouteSidebar panel={panel} onClose={onClose} /> : null;
    }
  }
}

export function RouteSidebar({
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
        <NavLink className="btn btn-primary btn-sm mt-4" to={panel.route}>
          Open {panel.label}
        </NavLink>
      </div>
    </aside>
  );
}
