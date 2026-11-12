import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { useThreadReadState } from "../../app/thread-read-state";
import { useUiPreferences } from "../../app/ui-preferences";
import { useProject, useThread } from "../../app-server/hooks";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

export function AppLayout() {
  const MIN_THREE_COLUMN_WIDTH = 1040;
  const RESIZE_HANDLE_WIDTH = 8;
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
  const [rightPaneWidth, setRightPaneWidth] = useState(320);
  const [isResizingRightPane, setIsResizingRightPane] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

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

  function handlePanelChange(panel: SidebarPanel) {
    if (panel === activePanel && !preferences.sidebarCollapsed) {
      update({ sidebarCollapsed: true });
      return;
    }
    setActivePanel(panel);
    update({ sidebarCollapsed: false });
  }

  function resizeRightPane(delta: number) {
    setRightPaneWidth((width) => {
      const availableMax = getRightPaneMaxWidth();
      return Math.min(availableMax, Math.max(240, width - delta));
    });
  }

  function getRightPaneMaxWidth() {
    const mainWidth = mainContentRef.current?.clientWidth ?? 0;
    if (mainWidth === 0) return 480;
    return Math.max(
      240,
      Math.min(480, mainWidth + rightPaneWidth - MIN_THREE_COLUMN_WIDTH - RESIZE_HANDLE_WIDTH),
    );
  }

  function handleRightPaneResizeStart(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPaneWidth;
    setIsResizingRightPane(true);

    function handlePointerMove(moveEvent: PointerEvent) {
      setRightPaneWidth(
        Math.min(
          getRightPaneMaxWidth(),
          Math.max(240, startWidth - (moveEvent.clientX - startX)),
        ),
      );
    }

    function handlePointerUp() {
      setIsResizingRightPane(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleRightPaneResizeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resizeRightPane(16);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      resizeRightPane(-16);
    }
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
      <div className="flex min-h-0 flex-1">
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
        <div
          className="flex min-w-0 min-h-0 flex-1 flex-col @container/chat"
          data-testid="chat-content-container"
          ref={mainContentRef}
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
        {rightPaneOpen && (
          <button
            aria-label="Resize right pane"
            className={`w-2 shrink-0 cursor-col-resize appearance-none border-0 border-l border-base-300/60 bg-base-300/20 p-0 transition-colors hover:bg-primary/30 ${isResizingRightPane ? "bg-primary/40" : ""}`}
            data-pane-width={rightPaneWidth}
            onKeyDown={handleRightPaneResizeKeyDown}
            onPointerDown={handleRightPaneResizeStart}
            type="button"
          />
        )}
        <aside
          aria-label="Right pane"
          className="shrink-0 overflow-hidden border-l border-base-300 bg-base-100 transition-[width] duration-200 ease-out"
          style={{ width: rightPaneOpen ? `${rightPaneWidth}px` : 0 }}
          data-testid="right-pane"
        />
      </div>
    </main>
  );
}
