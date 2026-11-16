import { i18n } from "../../app/i18n";
import { useTranslation } from "react-i18next";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { Outlet, useLocation, useParams } from "react-router-dom";
import type { AppOutletContext } from "../../app/app-outlet-context";
import { useThreadReadState } from "../../app/thread-read-state";
import { useUiPreferences } from "../../app/ui-preferences";
import { useProject, useThread } from "../../app-server/hooks";
import { handleTabListKeyDown } from "../common/tab-keyboard";
import {
  GitDiffReviewPane,
  type GitDiffReviewTarget,
} from "../git-diff/GitDiffReviewPane";
import { type SidebarPanel, sidebarPanelForPath } from "../sidebar/navigation";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import { TerminalPane } from "../terminal/TerminalPane";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../ui/resizable";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

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
  return i18n.t("navigation:gitDiffTab", { workspace: workspaceName });
}

function terminalTabLabel(cwd: string | null) {
  const workingDirectory =
    cwd?.split(/[\\/]/).filter(Boolean).at(-1) || i18n.t("navigation:home");
  return i18n.t("navigation:terminalTab", { directory: workingDirectory });
}

export function AppLayout() {
  const { t } = useTranslation("navigation");
  const location = useLocation();
  const { projectId, threadId } = useParams<{
    projectId?: string;
    threadId?: string;
  }>();
  const isChatRoute = location.pathname.startsWith("/chat/");
  const thread = useThread(threadId ?? "");
  const threadProjectId = isChatRoute ? thread.data?.thread.projectId : null;
  const project = useProject(projectId ?? threadProjectId ?? "");
  const { markThreadRead } = useThreadReadState();
  const { preferences, update } = useUiPreferences();
  const routePanel = sidebarPanelForPath(location.pathname);
  const hidesContextPanel =
    routePanel === "projects" ||
    routePanel === "account" ||
    location.pathname.startsWith("/approvals");
  const chatTitle =
    thread.data?.thread.name ||
    thread.data?.thread.preview ||
    t("navigation:conversation");
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
  }, [routePanel]);

  useEffect(() => {
    const enteredProjects =
      routePanel === "projects" && previousRoutePanel.current !== "projects";
    const enteredAccount =
      routePanel === "account" && previousRoutePanel.current !== "account";
    previousRoutePanel.current = routePanel;
    if ((enteredProjects || enteredAccount) && !preferences.sidebarCollapsed) {
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
    <main className="workbench fixed inset-0 flex h-dvh flex-col overflow-hidden bg-base-200 text-base-content">
      <BrowserNavigationBar
        chatProjectId={threadProjectId ?? undefined}
        chatTitle={chatTitle}
        onToggleSidebar={
          hidesContextPanel
            ? undefined
            : () => update({ sidebarCollapsed: !preferences.sidebarCollapsed })
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
        <ResizableHandle
          aria-label={t("navigation:resizeLeftPane")}
          withHandle
        />
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
          aria-label={t("navigation:resizeRightPane")}
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
            aria-label={t("navigation:rightPane")}
            className="h-full overflow-hidden border-l border-base-300 bg-base-100 transition-[width] duration-200 ease-out"
            data-testid="right-pane"
          >
            {rightPaneTabs.length > 0 && (
              <div className="flex h-full min-h-0 flex-col">
                <div
                  aria-label={t("navigation:rightPaneTabs")}
                  className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-base-300 px-2 pt-2"
                  onKeyDown={handleTabListKeyDown}
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
                        className={`flex shrink-0 items-center rounded-t-md ${
                          selected
                            ? "bg-base-100 text-base-content"
                            : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                        }`}
                        key={tab.id}
                        role="presentation"
                      >
                        <button
                          aria-controls={`right-pane-content-${tab.id}`}
                          aria-selected={selected}
                          className="max-w-52 truncate px-3 py-2 text-xs"
                          id={`right-pane-tab-${tab.id}`}
                          onClick={() => setActiveRightPaneTabId(tab.id)}
                          role="tab"
                          tabIndex={selected ? 0 : -1}
                          type="button"
                        >
                          {label}
                        </button>
                        <button
                          aria-label={t("navigation:closeTab", { label })}
                          className="mr-1 rounded p-1 text-base-content/50 hover:bg-base-300 hover:text-base-content"
                          onClick={() => closeRightPaneTab(tab.id)}
                          type="button"
                        >
                          <XMarkIcon aria-hidden="true" className="size-3.5" />
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
                      className="min-h-0 flex-1 overflow-hidden"
                      hidden={!selected}
                      id={`right-pane-content-${tab.id}`}
                      key={tab.id}
                      role="tabpanel"
                    >
                      {tab.kind === "git-diff" && (
                        <GitDiffReviewPane
                          isOpen={rightPaneOpen && selected}
                          target={tab.target}
                        />
                      )}
                      {tab.kind === "terminal" && (
                        <TerminalPane
                          cwd={tab.cwd}
                          isOpen={rightPaneOpen && selected}
                        />
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
