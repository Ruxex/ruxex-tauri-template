import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { useUiPreferences } from "../../app/ui-preferences";
import { ContextDrawer } from "../context/ContextDrawer";
import { ProjectSidebar, type SidebarPanel } from "../sidebar/ProjectSidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const location = useLocation();
  const { projectId, threadId } = useParams<{
    projectId?: string;
    threadId?: string;
  }>();
  const { preferences, update } = useUiPreferences();
  const routePanel = sidebarPanelForPath(location.pathname);
  const [activePanel, setActivePanel] = useState<SidebarPanel>(routePanel);

  useEffect(() => {
    setActivePanel(routePanel);
  }, [routePanel]);

  function handlePanelChange(panel: SidebarPanel) {
    if (panel === activePanel && !preferences.sidebarCollapsed) {
      update({ sidebarCollapsed: true });
      return;
    }
    setActivePanel(panel);
    update({ sidebarCollapsed: false });
  }

  return (
    <main className="workbench min-h-screen bg-base-200 text-base-content">
      <div className="flex min-h-screen">
        <ProjectSidebar
          activePanel={activePanel}
          collapsed={preferences.sidebarCollapsed}
          selectedProjectId={projectId}
          selectedThreadId={threadId}
          onPanelChange={handlePanelChange}
          onToggle={() =>
            update({ sidebarCollapsed: !preferences.sidebarCollapsed })
          }
        />
        <div className="min-w-0 flex-1">
          <TopBar
            contextDrawerOpen={preferences.contextDrawerOpen}
            onToggleContext={() =>
              update({ contextDrawerOpen: !preferences.contextDrawerOpen })
            }
            onToggleSidebar={() =>
              update({ sidebarCollapsed: !preferences.sidebarCollapsed })
            }
          />
          <section className="workbench-main mx-auto max-w-[1440px] p-4 sm:p-6">
            <Outlet />
          </section>
        </div>
        {preferences.contextDrawerOpen && (
          <div className="hidden xl:block">
            <ContextDrawer
              activeTab={preferences.contextTab}
              onClose={() => update({ contextDrawerOpen: false })}
              onTabChange={(contextTab) => update({ contextTab })}
              projectId={projectId}
              threadId={threadId}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function sidebarPanelForPath(pathname: string): SidebarPanel {
  if (pathname.startsWith("/settings")) {
    return "settings";
  }
  if (pathname.startsWith("/chat/new")) {
    return "new-chat";
  }
  if (pathname.startsWith("/approvals")) {
    return "approvals";
  }
  if (pathname.startsWith("/capabilities")) {
    return "capabilities";
  }
  if (pathname.startsWith("/schedules")) {
    return "schedules";
  }
  return "chats";
}
