import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  SIDEBAR_PANELS,
  type SidebarIcon,
  type SidebarPanel,
  type SidebarPanelDefinition,
} from "./navigation";
import { SidebarContextPanel } from "./RouteSidebar";

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 480;

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
  const navigate = useNavigate();
  const location = useLocation();
  const contextPanelVisible = showContextPanel && !collapsed;
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

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

  function resizeSidebar(delta: number) {
    setSidebarWidth((width) =>
      Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width + delta)),
    );
  }

  function handleSidebarResizeStart(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setIsResizingSidebar(true);

    function handlePointerMove(moveEvent: PointerEvent) {
      setSidebarWidth(
        Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX),
        ),
      );
    }

    function handlePointerUp() {
      setIsResizingSidebar(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleSidebarResizeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resizeSidebar(-16);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      resizeSidebar(16);
    }
  }

  const primaryPanels = SIDEBAR_PANELS.filter(
    (panel) => panel.id !== "account" && panel.id !== "settings",
  );
  const secondaryPanels = SIDEBAR_PANELS.filter(
    (panel) => panel.id === "account" || panel.id === "settings",
  );

  return (
    <aside
      className={`workbench-sidebar relative flex h-full min-h-0 shrink-0 ${contextPanelVisible ? "w-[20rem]" : "workbench-sidebar-collapsed"}`}
      aria-label="Workspace sidebar"
      style={{ width: contextPanelVisible ? `${sidebarWidth}px` : undefined }}
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
      {contextPanelVisible && (
        <SidebarContextPanel
          activePanel={activePanel}
          onClose={onToggle}
          selectedThreadId={selectedThreadId}
        />
      )}
      {contextPanelVisible && (
        <button
          aria-label="Resize left pane"
          className={`absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize appearance-none border-0 border-r border-base-300/60 bg-base-300/20 p-0 transition-colors hover:bg-primary/30 ${isResizingSidebar ? "bg-primary/40" : ""}`}
          data-pane-width={sidebarWidth}
          onKeyDown={handleSidebarResizeKeyDown}
          onPointerDown={handleSidebarResizeStart}
          title="Resize left pane"
          type="button"
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
