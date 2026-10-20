import { Outlet, useParams } from "react-router-dom";

import { useUiPreferences } from "../../app/ui-preferences";
import { ContextDrawer } from "../context/ContextDrawer";
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
