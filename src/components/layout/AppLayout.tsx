import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePanelRef } from "react-resizable-panels";
import { Outlet, useLocation, useParams } from "react-router-dom";
import type { AppOutletContext } from "../../app/app-outlet-context";
import { useThreadReadState } from "../../app/thread-read-state";
import { useUiPreferences } from "../../app/ui-preferences";
import { useProject, useThread } from "../../app-server/hooks";
import type { GitDiffReviewTarget } from "../git-diff/GitDiffReviewPane";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../ui/resizable";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

const GitDiffReviewPane = lazy(() =>
  import("../git-diff/GitDiffReviewPane").then((module) => ({
    default: module.GitDiffReviewPane,
  })),
);
const TerminalPane = lazy(() =>
  import("../terminal/TerminalPane").then((module) => ({
    default: module.TerminalPane,
  })),
);

const MAX_RIGHT_PANE_WIDTH = 1536;

type RightPaneTab =
  | {
      id: string;
      kind: "git-diff";
      target: GitDiffReviewTarget;
    }
  | {
      id: string;
      kind: "terminal";
      cwd: string | null;
    };

function gitDiffTabId(target: GitDiffReviewTarget) {
  return `git-diff:${encodeURIComponent(target.threadId)}:${encodeURIComponent(target.workspace)}`;
}

function gitDiffTabLabel(target: GitDiffReviewTarget) {
  const workspaceName =
    target.workspace.split(/[\\/]/).filter(Boolean).at(-1) || target.workspace;
  return `Git Diff — ${workspaceName}`;
}

function terminalTabLabel(cwd: string | null) {
  const workingDirectory = cwd?.split(/[\\/]/).filter(Boolean).at(-1) || "Home";
  return `Terminal — ${workingDirectory}`;
}

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
  const [rightPaneTabs, setRightPaneTabs] = useState<RightPaneTab[]>([]);
  const [activeRightPaneTabId, setActiveRightPaneTabId] = useState<
    string | null
  >(null);
  const leftPaneRef = usePanelRef();
  const rightPaneRef = usePanelRef();
  const previousRoutePanel = useRef<SidebarPanel | null>(null);
  const openThreadDiff = useCallback(
    (target: GitDiffReviewTarget) => {
      const id = gitDiffTabId(target);
      if (!rightPaneTabs.some((tab) => tab.id === id)) {
        setRightPaneTabs((tabs) => [...tabs, { id, kind: "git-diff", target }]);
      }
      setActiveRightPaneTabId(id);
      if (!rightPaneOpen) rightPaneRef.current?.resize("40%");
      setRightPaneOpen(true);
    },
    [rightPaneOpen, rightPaneRef, rightPaneTabs],
  );

  const openThreadTerminal = useCallback(
    ({ cwd }: { threadId: string; cwd: string | null }) => {
      const id = `terminal-tab-${crypto.randomUUID()}`;
      setRightPaneTabs((tabs) => [...tabs, { id, kind: "terminal", cwd }]);
      setActiveRightPaneTabId(id);
      if (!rightPaneOpen) rightPaneRef.current?.resize("40%");
      setRightPaneOpen(true);
    },
    [rightPaneOpen, rightPaneRef],
  );

  const closeRightPaneTab = useCallback(
    (tabId: string) => {
      const tabIndex = rightPaneTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return;

      const remainingTabs = rightPaneTabs.filter((tab) => tab.id !== tabId);
      setRightPaneTabs(remainingTabs);
      if (remainingTabs.length === 0) {
        setActiveRightPaneTabId(null);
        setRightPaneOpen(false);
      } else if (activeRightPaneTabId === tabId) {
        setActiveRightPaneTabId(
          remainingTabs[Math.max(0, tabIndex - 1)]?.id ?? remainingTabs[0].id,
        );
      }
    },
    [activeRightPaneTabId, rightPaneTabs],
  );

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
    const enteredProjects =
      routePanel === "projects" && previousRoutePanel.current !== "projects";
    previousRoutePanel.current = routePanel;
    if (enteredProjects && !preferences.sidebarCollapsed) {
      update({ sidebarCollapsed: true });
    }
  }, [preferences.sidebarCollapsed, routePanel, update]);

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
        onToggleSidebar={() =>
          update({ sidebarCollapsed: !preferences.sidebarCollapsed })
        }
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
        <ResizablePanel className="min-w-0" id="main-content">
          <div
            className="flex min-w-0 min-h-0 h-full flex-1 flex-col @container/chat"
            data-testid="chat-content-container"
          >
            <section
              className={`workbench-main min-h-0 w-full flex-1 ${
                isChatRoute
                  ? "overflow-y-auto p-0"
                  : "overflow-y-auto p-4 sm:p-6"
              }`}
              data-conversation-scroll={isChatRoute ? "true" : undefined}
            >
              <Outlet
                context={
                  {
                    openThreadDiff,
                    openThreadTerminal,
                  } satisfies AppOutletContext
                }
              />
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
          >
            {rightPaneTabs.length > 0 && (
              <div className="flex h-full min-h-0 flex-col">
                <div
                  aria-label="Right pane tabs"
                  className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-base-300 px-2 pt-2"
                  role="tablist"
                >
                  {rightPaneTabs.map((tab) => {
                    const label =
                      tab.kind === "git-diff"
                        ? gitDiffTabLabel(tab.target)
                        : terminalTabLabel(tab.cwd);
                    const selected = tab.id === activeRightPaneTabId;
                    return (
                      <div
                        className="flex shrink-0 items-center"
                        key={tab.id}
                        role="presentation"
                      >
                        <button
                          aria-controls={`right-pane-content-${tab.id}`}
                          aria-selected={selected}
                          className={`max-w-52 truncate rounded-t-md px-3 py-2 text-xs ${
                            selected
                              ? "bg-base-100 text-base-content"
                              : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                          }`}
                          id={`right-pane-tab-${tab.id}`}
                          onClick={() => setActiveRightPaneTabId(tab.id)}
                          role="tab"
                          type="button"
                        >
                          {label}
                        </button>
                        <button
                          aria-label={`Close ${label} tab`}
                          className="rounded p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content"
                          onClick={() => closeRightPaneTab(tab.id)}
                          type="button"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {rightPaneTabs.map((tab) => {
                  const selected = tab.id === activeRightPaneTabId;
                  return (
                    <div
                      aria-labelledby={`right-pane-tab-${tab.id}`}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                      hidden={!selected}
                      id={`right-pane-content-${tab.id}`}
                      key={tab.id}
                      role="tabpanel"
                    >
                      {tab.kind === "git-diff" && (
                        <Suspense
                          fallback={
                            <div
                              className="p-4 text-sm text-base-content/60"
                              role="status"
                            >
                              Loading diff viewer…
                            </div>
                          }
                        >
                          <GitDiffReviewPane
                            isOpen={rightPaneOpen && selected}
                            target={tab.target}
                          />
                        </Suspense>
                      )}
                      {tab.kind === "terminal" && (
                        <Suspense
                          fallback={
                            <div
                              className="p-4 text-sm text-base-content/60"
                              role="status"
                            >
                              Loading terminal…
                            </div>
                          }
                        >
                          <TerminalPane
                            cwd={tab.cwd}
                            isOpen={rightPaneOpen && selected}
                          />
                        </Suspense>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
