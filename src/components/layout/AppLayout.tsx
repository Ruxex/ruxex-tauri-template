import { Outlet, useParams } from "react-router-dom";

import { useUiPreferences } from "../../app/ui-preferences";
import { ProjectSidebar } from "../sidebar/ProjectSidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const { projectId, threadId } = useParams<{
    projectId?: string;
    threadId?: string;
  }>();
  const { preferences, update } = useUiPreferences();

  return (
    <main className="workbench min-h-screen bg-base-200 text-base-content">
      <div className="flex min-h-screen">
        <ProjectSidebar
          collapsed={preferences.sidebarCollapsed}
          selectedProjectId={projectId}
          selectedThreadId={threadId}
          onToggle={() => update({ sidebarCollapsed: !preferences.sidebarCollapsed })}
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
          <aside className="context-drawer hidden w-80 shrink-0 border-l border-base-300 bg-base-100 xl:block">
            <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  Workbench
                </p>
                <h2 className="font-semibold">Context</h2>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                aria-label="Close context panel"
                onClick={() => update({ contextDrawerOpen: false })}
              >
                ×
              </button>
            </div>
            <div className="context-drawer-slot p-4 text-sm text-base-content/60">
              Activity, changes, and project context appear here while you work.
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
