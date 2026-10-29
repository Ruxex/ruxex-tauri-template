import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { useUiPreferences } from "../../app/ui-preferences";
import { useThread } from "../../app-server/hooks";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

export function AppLayout() {
  const location = useLocation();
  const { threadId } = useParams<{
    threadId?: string;
  }>();
  const thread = useThread(threadId ?? "");
  const { preferences, update } = useUiPreferences();
  const routePanel = sidebarPanelForPath(location.pathname);
  const isChatRoute = location.pathname.startsWith("/chat/");
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
    <main
      className={`workbench flex flex-col bg-base-200 text-base-content ${isChatRoute ? "min-h-dvh overflow-y-auto" : "h-dvh overflow-hidden"}`}
      data-conversation-scroll={isChatRoute ? "true" : undefined}
    >
      <BrowserNavigationBar chatTitle={chatTitle} />
      <div
        className={`flex flex-1 ${isChatRoute ? "min-h-[calc(100dvh-2rem)]" : "min-h-0"}`}
      >
        {!preferences.sidebarCollapsed && activePanel !== "projects" && (
          <button
            aria-label="Close sidebar overlay"
            className="workbench-sidebar-backdrop"
            type="button"
            onClick={() => update({ sidebarCollapsed: true })}
          />
        )}
        <ProjectSidebar
          activePanel={activePanel}
          collapsed={preferences.sidebarCollapsed}
          selectedThreadId={threadId}
          onPanelChange={handlePanelChange}
          onToggle={() =>
            update({ sidebarCollapsed: !preferences.sidebarCollapsed })
          }
        />
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <section
            className={`workbench-main mx-auto w-full max-w-[1440px] flex-1 ${
              isChatRoute ? "p-0" : "min-h-0 overflow-y-auto p-4 sm:p-6"
            }`}
          >
            <Outlet />
          </section>
        </div>
      </div>
    </main>
  );
}
