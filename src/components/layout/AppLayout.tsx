import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { useUiPreferences } from "../../app/ui-preferences";
import { useProject, useThread } from "../../app-server/hooks";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

export function AppLayout() {
  const location = useLocation();
  const { projectId, threadId } = useParams<{
    projectId?: string;
    threadId?: string;
  }>();
  const thread = useThread(threadId ?? "");
  const project = useProject(projectId ?? "");
  const { preferences, update } = useUiPreferences();
  const routePanel = sidebarPanelForPath(location.pathname);
  const isChatRoute = location.pathname.startsWith("/chat/");
  const hidesSidebar = routePanel === "projects" || routePanel === "account";
  const chatTitle =
    thread.data?.thread.name || thread.data?.thread.preview || "Conversation";
  const [activePanel, setActivePanel] = useState<SidebarPanel>(routePanel);

  useEffect(() => {
    setActivePanel(routePanel);
  }, [routePanel]);

  useEffect(() => {
    if (preferences.sidebarCollapsed) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        update({ sidebarCollapsed: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preferences.sidebarCollapsed, update]);

  function handlePanelChange(panel: SidebarPanel) {
    if (panel === activePanel && !preferences.sidebarCollapsed) {
      update({ sidebarCollapsed: true });
      return;
    }
    setActivePanel(panel);
    update({ sidebarCollapsed: false });
  }

  return (
    <main className="workbench flex h-dvh flex-col overflow-hidden bg-base-200 text-base-content">
      <BrowserNavigationBar
        chatTitle={chatTitle}
        projectTitle={project.data?.project.name}
      />
      <div className="flex min-h-0 flex-1">
        {!hidesSidebar && !preferences.sidebarCollapsed && (
          <button
            aria-label="Close sidebar overlay"
            className="workbench-sidebar-backdrop"
            type="button"
            onClick={() => update({ sidebarCollapsed: true })}
          />
        )}
        {!hidesSidebar && (
          <ProjectSidebar
            activePanel={activePanel}
            collapsed={preferences.sidebarCollapsed}
            selectedThreadId={threadId}
            onPanelChange={handlePanelChange}
            onToggle={() =>
              update({ sidebarCollapsed: !preferences.sidebarCollapsed })
            }
          />
        )}
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <section
            className={`workbench-main mx-auto min-h-0 w-full max-w-[1440px] flex-1 ${
              isChatRoute ? "overflow-y-auto p-0" : "overflow-y-auto p-4 sm:p-6"
            }`}
            data-conversation-scroll={isChatRoute ? "true" : undefined}
          >
            <Outlet />
          </section>
        </div>
      </div>
    </main>
  );
}
