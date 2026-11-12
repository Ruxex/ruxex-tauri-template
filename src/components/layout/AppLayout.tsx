import { useEffect, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { useThreadReadState } from "../../app/thread-read-state";
import { useUiPreferences } from "../../app/ui-preferences";
import { useProject, useThread } from "../../app-server/hooks";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../ui/resizable";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

const MAX_RIGHT_PANE_WIDTH = 1536;

export function AppLayout() {
  const location = useLocation();
  const { projectId, threadId } = useParams<{
    projectId?: string;
    threadId?: string;
  }>();
  const thread = useThread(threadId ?? "");
  const project = useProject(projectId ?? "");
  const { markThreadRead } = useThreadReadState();
  const { preferences, update } = useUiPreferences();
  const routePanel = sidebarPanelForPath(location.pathname);
  const isChatRoute = location.pathname.startsWith("/chat/");
  const hidesContextPanel =
    routePanel === "projects" || location.pathname.startsWith("/approvals");
  const chatTitle =
    thread.data?.thread.name || thread.data?.thread.preview || "Conversation";
  const [activePanel, setActivePanel] = useState<SidebarPanel>(routePanel);
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  const leftPaneRef = usePanelRef();
  const rightPaneRef = usePanelRef();

  useEffect(() => {
    const loadedThread = thread.data?.thread;
    if (
      !isChatRoute ||
      !threadId ||
      !loadedThread ||
      loadedThread.id !== threadId ||
      !Number.isFinite(loadedThread.updatedAt)
    ) {
      return;
    }
    markThreadRead(threadId, loadedThread.updatedAt);
  }, [isChatRoute, markThreadRead, thread.data?.thread, threadId]);

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

  useEffect(() => {
    if (preferences.sidebarCollapsed) {
      leftPaneRef.current?.collapse();
    } else {
      leftPaneRef.current?.expand();
    }
  }, [leftPaneRef, preferences.sidebarCollapsed]);

  useEffect(() => {
    if (rightPaneOpen) {
      rightPaneRef.current?.expand();
    } else {
      rightPaneRef.current?.collapse();
    }
  }, [rightPaneOpen, rightPaneRef]);

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
        onToggleSidebar={() => update({ sidebarCollapsed: !preferences.sidebarCollapsed })}
        onToggleRightPane={() => setRightPaneOpen((open) => !open)}
        projectTitle={project.data?.project.name}
        rightPaneOpen={rightPaneOpen}
        sidebarOpen={!preferences.sidebarCollapsed}
      />
      <ResizablePanelGroup
        className="flex min-h-0 flex-1"
        data-testid="pane-resizable-group"
        orientation="horizontal"
      >
        <ResizablePanel
          className="min-w-0"
          collapsedSize={64}
          collapsible
          defaultSize={320}
          id="left-sidebar"
          maxSize={480}
          minSize={240}
          panelRef={leftPaneRef}
        >
          <ProjectSidebar
            activePanel={activePanel}
            collapsed={preferences.sidebarCollapsed}
            selectedThreadId={threadId}
            showContextPanel={!hidesContextPanel}
            onPanelChange={handlePanelChange}
            onToggle={() =>
              update({ sidebarCollapsed: !preferences.sidebarCollapsed })
            }
          />
        </ResizablePanel>
        <ResizableHandle aria-label="Resize left pane" withHandle />
        <ResizablePanel
          className="min-w-0"
          id="main-content"
        >
          <div
            className="flex min-w-0 min-h-0 h-full flex-1 flex-col @container/chat"
            data-testid="chat-content-container"
          >
            <section
              className={`workbench-main min-h-0 w-full flex-1 ${
                isChatRoute ? "overflow-y-auto p-0" : "overflow-y-auto p-4 sm:p-6"
              }`}
              data-conversation-scroll={isChatRoute ? "true" : undefined}
            >
              <Outlet />
            </section>
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize right pane"
          className={rightPaneOpen ? undefined : "hidden"}
          data-testid="right-pane-resize-handle"
          withHandle
        />
        <ResizablePanel
          className="min-w-0"
          collapsedSize={0}
          collapsible
          data-max-size={MAX_RIGHT_PANE_WIDTH}
          data-pane-open={rightPaneOpen}
          data-testid="right-pane-panel"
          defaultSize={320}
          id="right-pane"
          maxSize={MAX_RIGHT_PANE_WIDTH}
          minSize={240}
          panelRef={rightPaneRef}
        >
          <aside
            aria-label="Right pane"
            className="h-full overflow-hidden border-l border-base-300 bg-base-100 transition-[width] duration-200 ease-out"
            data-testid="right-pane"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
