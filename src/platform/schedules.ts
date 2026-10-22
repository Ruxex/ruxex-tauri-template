import { invoke } from "@tauri-apps/api/core";

export type ScheduleCadence =
  | { kind: "once"; at: string }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekly"; weekday: number; hour: number; minute: number };

export type ScheduleInput = {
  name: string;
  prompt: string;
  threadId: string | null;
  cadence: ScheduleCadence;
};

export type ScheduleRun = {
  at: string;
  success: boolean;
  message: string;
};

export type ScheduleRecord = ScheduleInput & {
  id: string;
  nextRunAt: string;
  enabled: boolean;
  lastRun: ScheduleRun | null;
};

export function listSchedules(): Promise<ScheduleRecord[]> {
  return invoke<ScheduleRecord[]>("schedule_list");
}

export function createSchedule(input: ScheduleInput): Promise<ScheduleRecord> {
  return invoke<ScheduleRecord>("schedule_create", { input });
}

export function updateSchedule(
  id: string,
  input: ScheduleInput,
): Promise<ScheduleRecord> {
  return invoke<ScheduleRecord>("schedule_update", { id, input });
}

export function setScheduleEnabled(
  id: string,
  enabled: boolean,
): Promise<ScheduleRecord> {
  return invoke<ScheduleRecord>("schedule_set_enabled", { id, enabled });
}

export function deleteSchedule(id: string): Promise<void> {
  return invoke("schedule_delete", { id });
}

export function runScheduleNow(id: string): Promise<ScheduleRecord> {
  return invoke<ScheduleRecord>("schedule_run_now", { id });
}
