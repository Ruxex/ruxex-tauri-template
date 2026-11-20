import { XMarkIcon } from "@heroicons/react/24/outline";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePanelRef } from "react-resizable-panels";
import { Outlet, useLocation, useParams } from "react-router-dom";
import type { AppOutletContext } from "@/app/app-outlet-context";
import { i18n } from "@/app/i18n";
import { useThreadReadState } from "@/app/thread-read-state";
import { useUiPreferences } from "@/app/ui-preferences";
import { useProject, useThread } from "@/app-server/hooks";
import { handleTabListKeyDown } from "@/components/base/common/tab-keyboard";
import {
  closeManagedTerminalSession,
  DEFAULT_TERMINAL_SESSION_TIMEOUT,
  readTerminalSessionTimeout,
  setTerminalSessionIdleTimeout,
  terminalSessionTimeoutMs,
} from "@/platform/terminal";
import { GitDiffReviewPane, type GitDiffReviewTarget } from "@/components/composite/git-diff/GitDiffReviewPane";
import { type SidebarPanel, sidebarPanelForPath } from "@/components/feature/sidebar/navigation";
import { ProjectSidebar } from "@/components/feature/sidebar/ProjectSidebar";
import { TerminalPane } from "@/components/composite/terminal/TerminalPane";
import { SubagentConversationPane } from "@/components/composite/thread-summary/SubagentConversationPane";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/base/ui/resizable";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

const MAX_RIGHT_PANE_WIDTH = 1536;
const LEFT_PANE_COLLAPSED_SIZE = 56;
type PanelResizeHandler = NonNullable<ComponentProps<typeof ResizablePanel>["onResize"]>;

type RightPaneTab =
  | {
      id: string;
      kind: "git-diff";
      ownerThreadId: string;
      target: GitDiffReviewTarget;
    }
  | {
      id: string;
      kind: "terminal";
      cwd: string | null;
    }
  | {
      id: string;
      kind: "subagent-chat";
      ownerThreadId: string;
      threadId: string;
      label: string;
    };

function gitDiffTabId(target: GitDiffReviewTarget) {
  return `git-diff:${encodeURIComponent(target.threadId)}:${encodeURIComponent(target.workspace)}`;
}

function gitDiffTabLabel(target: GitDiffReviewTarget) {
  const workspaceName = target.workspace.split(/[\\/]/).filter(Boolean).at(-1) || target.workspace;
  return i18n.t("navigation:gitDiffTab", { workspace: workspaceName });
}

function terminalTabLabel(cwd: string | null) {
  const workingDirectory = cwd?.split(/[\\/]/).filter(Boolean).at(-1) || i18n.t("navigation:home");
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
  const hidesContextPanel = routePanel === "projects" || routePanel === "account";
  const chatTitle = thread.data?.thread.name || thread.data?.thread.preview || t("navigation:conversation");
  const [activePanel, setActivePanel] = useState<SidebarPanel>(routePanel);
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  const [chatTabsByThread, setChatTabsByThread] = useState<Record<string, RightPaneTab[]>>({});
  const [terminalTabs, setTerminalTabs] = useState<RightPaneTab[]>([]);
  const [activeChatTabIds, setActiveChatTabIds] = useState<Record<string, string>>({});
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(null);
  const [terminalSessionTimeout, setTerminalSessionTimeout] = useState(DEFAULT_TERMINAL_SESSION_TIMEOUT);
  const chatScopeId = isChatRoute ? (threadId ?? "new-chat") : "non-chat";
  const chatTabs = chatTabsByThread[chatScopeId] ?? [];
  const rightPaneTabs = [...chatTabs, ...terminalTabs];
  const activeRightPaneTabId =
    (activeTerminalTabId && terminalTabs.some((tab) => tab.id === activeTerminalTabId) ? activeTerminalTabId : null) ??
    activeChatTabIds[chatScopeId] ??
    rightPaneTabs[0]?.id ??
    null;
  const leftPaneRef = usePanelRef();
  const rightPaneRef = usePanelRef();
  const previousRoutePanel = useRef<SidebarPanel | null>(null);
  const visibleTabsRef = useRef(rightPaneTabs);
  visibleTabsRef.current = rightPaneTabs;
  const handleLeftPaneResize = useCallback<PanelResizeHandler>(
    (size, _id, previousSize) => {
      if (previousSize === undefined) return;

      const collapsed = size.inPixels <= LEFT_PANE_COLLAPSED_SIZE;
      if (collapsed !== preferences.sidebarCollapsed) {
        update({ sidebarCollapsed: collapsed });
      }
    },
    [preferences.sidebarCollapsed, update],
  );
  const handleRightPaneResize = useCallback<PanelResizeHandler>((size, _id, previousSize) => {
    if (previousSize === undefined) return;

    const open = size.inPixels > 0;
    setRightPaneOpen((current) => (current === open ? current : open));
  }, []);
  const openThreadDiff = useCallback(
    (target: GitDiffReviewTarget) => {
      const id = gitDiffTabId(target);
      const ownerThreadId = chatScopeId;
      setChatTabsByThread((tabsByThread) => {
        const tabs = tabsByThread[ownerThreadId] ?? [];
        return tabs.some((tab) => tab.id === id)
          ? tabsByThread
          : {
              ...tabsByThread,
              [ownerThreadId]: [
                ...tabs,
                {
                  id,
                  kind: "git-diff",
                  ownerThreadId,
                  target,
                },
              ],
            };
      });
      setActiveChatTabIds((active) => ({
        ...active,
        [ownerThreadId]: id,
      }));
      setActiveTerminalTabId(null);
      if (!rightPaneOpen) rightPaneRef.current?.resize("40%");
      setRightPaneOpen(true);
    },
    [chatScopeId, rightPaneOpen, rightPaneRef],
  );

  const openThreadTerminal = useCallback(
    ({ cwd }: { threadId: string; cwd: string | null }) => {
      const id = `terminal-tab-${crypto.randomUUID()}`;
      setTerminalTabs((tabs) => [...tabs, { id, kind: "terminal", cwd }]);
      setActiveTerminalTabId(id);
      if (!rightPaneOpen) rightPaneRef.current?.resize("40%");
      setRightPaneOpen(true);
    },
    [rightPaneOpen, rightPaneRef],
  );

  const openSubagentChat = useCallback(
    ({ threadId: subagentThreadId, label }: { threadId: string; label: string }) => {
      if (!isChatRoute || !threadId) return;
      const ownerThreadId = chatScopeId;
      const id = `subagent-chat:${encodeURIComponent(subagentThreadId)}`;
      setChatTabsByThread((tabsByThread) => {
        const tabs = tabsByThread[ownerThreadId] ?? [];
        return tabs.some((tab) => tab.id === id)
          ? tabsByThread
          : {
              ...tabsByThread,
              [ownerThreadId]: [
                ...tabs,
                {
                  id,
                  kind: "subagent-chat",
                  ownerThreadId,
                  threadId: subagentThreadId,
                  label,
                },
              ],
            };
      });
      setActiveChatTabIds((active) => ({ ...active, [ownerThreadId]: id }));
      setActiveTerminalTabId(null);
      if (!rightPaneOpen) rightPaneRef.current?.resize("40%");
      setRightPaneOpen(true);
    },
    [chatScopeId, isChatRoute, rightPaneOpen, rightPaneRef, threadId],
  );

  const closeRightPaneTab = useCallback(
    (tabId: string) => {
      const tabIndex = visibleTabsRef.current.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return;

      const tab = visibleTabsRef.current[tabIndex];
      if (tab.kind === "terminal") {
        setTerminalTabs((tabs) => tabs.filter((item) => item.id !== tabId));
        void closeManagedTerminalSession(tabId);
        if (activeTerminalTabId === tabId) setActiveTerminalTabId(null);
      } else {
        const ownerTabs = chatTabsByThread[tab.ownerThreadId] ?? [];
        const ownerTabIndex = ownerTabs.findIndex((item) => item.id === tabId);
        const remainingOwnerTabs = ownerTabs.filter((item) => item.id !== tabId);
        setChatTabsByThread((tabsByThread) => {
          const tabs = tabsByThread[tab.ownerThreadId] ?? [];
          return {
            ...tabsByThread,
            [tab.ownerThreadId]: tabs.filter((item) => item.id !== tabId),
          };
        });
        if (activeChatTabIds[tab.ownerThreadId] === tabId) {
          setActiveChatTabIds((active) => {
            const next = { ...active };
            const nextTab = remainingOwnerTabs[Math.max(0, ownerTabIndex - 1)]?.id ?? remainingOwnerTabs[0]?.id;
            if (nextTab) next[tab.ownerThreadId] = nextTab;
            else delete next[tab.ownerThreadId];
            return next;
          });
        }
      }
      if (visibleTabsRef.current.length === 1) {
        setRightPaneOpen(false);
      }
    },
    [activeChatTabIds, activeTerminalTabId, chatTabsByThread],
  );

  useEffect(() => {
    setTerminalSessionIdleTimeout(terminalSessionTimeoutMs(terminalSessionTimeout));
  }, [terminalSessionTimeout]);

  useEffect(() => {
    let active = true;
    void readTerminalSessionTimeout()
      .then((timeout) => {
        if (active) setTerminalSessionTimeout(timeout);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
    const enteredProjects = routePanel === "projects" && previousRoutePanel.current !== "projects";
    const enteredAccount = routePanel === "account" && previousRoutePanel.current !== "account";
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
    if (panel === "projects") {
      setActivePanel(panel);
      if (!preferences.sidebarCollapsed) {
        update({ sidebarCollapsed: true });
      }
      return;
    }

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
          hidesContextPanel ? undefined : () => update({ sidebarCollapsed: !preferences.sidebarCollapsed })
        }
        onToggleRightPane={() => setRightPaneOpen((open) => !open)}
        projectTitle={project.data?.project.name}
        rightPaneOpen={rightPaneOpen}
        sidebarOpen={!preferences.sidebarCollapsed}
      />
      <ResizablePanelGroup className="flex min-h-0 flex-1" data-testid="pane-resizable-group" orientation="horizontal">
        <ResizablePanel
          className="min-w-0"
          collapsedSize={LEFT_PANE_COLLAPSED_SIZE}
          collapsible
          defaultSize={320}
          groupResizeBehavior="preserve-pixel-size"
          id="left-sidebar"
          maxSize={480}
          minSize={240}
          onResize={handleLeftPaneResize}
          panelRef={leftPaneRef}
        >
          <ProjectSidebar
            activePanel={activePanel}
            collapsed={preferences.sidebarCollapsed}
            selectedThreadId={threadId}
            showContextPanel={!hidesContextPanel}
            onPanelChange={handlePanelChange}
            onToggle={() => update({ sidebarCollapsed: !preferences.sidebarCollapsed })}
          />
        </ResizablePanel>
        <ResizableHandle aria-label={t("navigation:resizeLeftPane")} withHandle />
        <ResizablePanel className="min-w-0" id="main-content">
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
              <Outlet
                context={
                  {
                    openThreadDiff,
                    openThreadTerminal,
                    openSubagentChat,
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
          groupResizeBehavior="preserve-pixel-size"
          id="right-pane"
          maxSize={MAX_RIGHT_PANE_WIDTH}
          minSize={240}
          onResize={handleRightPaneResize}
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
                        : tab.kind === "terminal"
                          ? terminalTabLabel(tab.cwd)
                          : tab.label;
                    const selected = tab.id === activeRightPaneTabId;
                    return (
                      <div
                        className={`flex shrink-0 items-center rounded-t-lg border border-b-0 border-base-300 ${
                          selected
                            ? "bg-base-100 text-base-content"
                            : "bg-base-200 text-base-content/70 hover:text-base-content"
                        }`}
                        key={tab.id}
                        role="presentation"
                      >
                        <button
                          aria-controls={`right-pane-content-${tab.id}`}
                          aria-selected={selected}
                          className="max-w-52 truncate px-3 py-2 text-xs"
                          id={`right-pane-tab-${tab.id}`}
                          onClick={() => {
                            if (tab.kind === "terminal") {
                              setActiveTerminalTabId(tab.id);
                            } else {
                              setActiveTerminalTabId(null);
                              setActiveChatTabIds((active) => ({
                                ...active,
                                [tab.ownerThreadId]: tab.id,
                              }));
                            }
                          }}
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
                      {rightPaneOpen && selected && tab.kind === "git-diff" && (
                        <GitDiffReviewPane isOpen target={tab.target} />
                      )}
                      {rightPaneOpen && selected && tab.kind === "terminal" && (
                        <TerminalPane tabId={tab.id} cwd={tab.cwd} />
                      )}
                      {rightPaneOpen && selected && tab.kind === "subagent-chat" && (
                        <SubagentConversationPane threadId={tab.threadId} />
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
