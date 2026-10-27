import type { ThreadExecutionState } from "../../app-server/event-reducer";
import type { v2 } from "../../protocol";
import { taskStatusFromThreadStatus, type TaskStatus } from "./task-status";

export type OrganizableTask = {
  archived?: boolean;
  id: string;
  liveStatus?: ThreadExecutionState["status"];
  name?: string | null;
  pinned?: boolean;
  preview?: string | null;
  status?: v2.ThreadStatus;
  updatedAt: number;
  waitingForRequest?: boolean;
};

export type OrganizedTasks<Task extends OrganizableTask = OrganizableTask> = {
  active: Task[];
  archived: Task[];
  pinned: Task[];
  recent: Task[];
};

export function taskStatusForOrganization(
  task: OrganizableTask,
): TaskStatus | undefined {
  return taskStatusFromThreadStatus(
    task.status,
    task.liveStatus,
    task.waitingForRequest,
  );
}

export function organizeTasks<Task extends OrganizableTask>(
  tasks: Task[],
): OrganizedTasks<Task> {
  const result: OrganizedTasks<Task> = {
    active: [],
    archived: [],
    pinned: [],
    recent: [],
  };

  for (const task of tasks) {
    if (task.archived) {
      result.archived.push(task);
      continue;
    }
    if (task.pinned) {
      result.pinned.push(task);
      continue;
    }
    const status = taskStatusForOrganization(task);
    if (status === "running" || status === "waiting") {
      result.active.push(task);
    } else {
      result.recent.push(task);
    }
  }

  for (const group of Object.values(result)) {
    group.sort((left, right) => right.updatedAt - left.updatedAt);
  }
  return result;
}
