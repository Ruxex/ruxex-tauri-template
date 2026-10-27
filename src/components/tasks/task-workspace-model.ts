import type { ThreadExecutionState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { taskStatusFromThreadStatus, type TaskStatus } from "./task-status";

export type TaskWorkspaceStatusInput = {
  latestTurn?: Pick<v2.Turn, "status"> | null;
  liveThread?: Pick<ThreadExecutionState, "activeTurnId" | "status"> | null;
  pendingRequestCount: number;
  projectRoots?: string[];
  reconnecting: boolean;
  thread: Pick<v2.Thread, "cwd" | "gitInfo" | "status">;
};

export type TaskWorkspaceStatus = {
  branch: string | null;
  projectRoot: string | null;
  projectRootCount: number;
  reconnecting: boolean;
  status: TaskStatus | undefined;
  workspacePath: string | null;
};

export function getTaskWorkspaceStatus(
  input: TaskWorkspaceStatusInput,
): TaskWorkspaceStatus {
  const status =
    input.pendingRequestCount > 0
      ? "waiting"
      : (taskStatusFromLiveThread(input.liveThread) ??
        taskStatusFromTurn(input.latestTurn?.status) ??
        taskStatusFromThreadStatus(input.thread.status));
  const projectRoots = input.projectRoots ?? [];

  return {
    branch: input.thread.gitInfo?.branch ?? null,
    projectRoot: projectRoots[0] ?? null,
    projectRootCount: projectRoots.length,
    reconnecting: input.reconnecting,
    status,
    workspacePath: input.thread.cwd || null,
  };
}

function taskStatusFromLiveThread(
  liveThread:
    | Pick<ThreadExecutionState, "activeTurnId" | "status">
    | null
    | undefined,
): TaskStatus | undefined {
  if (!liveThread) return undefined;
  switch (liveThread.status) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "interrupted":
      return "stopped";
    case "resynchronizing":
      return liveThread.activeTurnId ? "running" : undefined;
    default:
      return undefined;
  }
}

function taskStatusFromTurn(
  status: v2.Turn["status"] | undefined,
): TaskStatus | undefined {
  switch (status) {
    case "inProgress":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "interrupted":
      return "stopped";
    default:
      return undefined;
  }
}
