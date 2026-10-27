import type { ThreadExecutionState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import type { TaskContextTab } from "./TaskContextPanel";
import { taskStatusClassName, taskStatusLabel } from "./task-status";
import { getTaskWorkspaceStatus } from "./task-workspace-model";

type TaskHeaderProps = {
  latestTurn?: v2.Turn | null;
  liveThread?: ThreadExecutionState | null;
  onResume: () => void;
  onOpenContext?: (tab: TaskContextTab) => void;
  onStartReview: () => void;
  onStop: () => void;
  pendingRequestCount: number;
  projectName?: string | null;
  projectRoots?: string[];
  reconnecting: boolean;
  thread: v2.Thread;
};

export function TaskHeader({
  latestTurn,
  liveThread,
  onOpenContext,
  onResume,
  onStartReview,
  onStop,
  pendingRequestCount,
  projectName,
  projectRoots,
  reconnecting,
  thread,
}: TaskHeaderProps) {
  const workspace = getTaskWorkspaceStatus({
    latestTurn,
    liveThread,
    pendingRequestCount,
    projectRoots,
    reconnecting,
    thread,
  });
  const title = thread.name || thread.preview || "Untitled task";
  const canStop = Boolean(liveThread?.activeTurnId);
  const canResume = workspace.status === "stopped";

  function openReview() {
    onStartReview();
    onOpenContext?.("review");
  }

  return (
    <header className="space-y-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Task
          </p>
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/65">
            {projectName && <span>{projectName}</span>}
            {workspace.workspacePath && (
              <span className="truncate" title={workspace.workspacePath}>
                {workspace.workspacePath}
              </span>
            )}
            {workspace.branch && <span>{workspace.branch}</span>}
          </div>
          {workspace.projectRoot && workspace.projectRootCount > 1 && (
            <p className="mt-1 text-xs text-base-content/55">
              Project root: {workspace.projectRoot} ·{" "}
              {workspace.projectRootCount} roots
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {workspace.status && (
            <span
              aria-label={`Task status: ${taskStatusLabel(workspace.status)}`}
              className={`badge ${taskStatusClassName(workspace.status)}`}
              role="status"
            >
              {taskStatusLabel(workspace.status)}
            </span>
          )}
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={onStop}
            disabled={!canStop}
          >
            Stop task
          </button>
          {canResume && (
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={onResume}
            >
              Resume task
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={openReview}
          >
            Review changes
          </button>
          {onOpenContext && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => onOpenContext("terminal")}
              >
                Open terminal
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => onOpenContext("files")}
              >
                Open files
              </button>
            </>
          )}
        </div>
      </div>
      {workspace.reconnecting && (
        <p className="text-sm text-warning" role="status">
          Reconnecting…
        </p>
      )}
      {pendingRequestCount > 0 && (
        <p className="text-sm text-warning" role="status">
          {pendingRequestCount} pending request
          {pendingRequestCount === 1 ? "" : "s"}
        </p>
      )}
    </header>
  );
}
