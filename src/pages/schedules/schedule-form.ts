import type {
  ScheduleCadence,
  ScheduleInput,
  ScheduleRecord,
} from "../../platform/schedules";

export type ScheduleFormState = {
  name: string;
  prompt: string;
  cadenceKind: ScheduleCadence["kind"];
  runAtTime: string;
  weekdays: string[];
  onceAt: string;
  enabled: boolean;
};

export type ScheduleFormAction =
  | { type: "reset"; schedule?: ScheduleRecord }
  | { type: "nameChanged"; value: string }
  | { type: "promptChanged"; value: string }
  | { type: "cadenceChanged"; value: ScheduleCadence["kind"] }
  | { type: "runAtTimeChanged"; value: string }
  | { type: "weekdaysChanged"; value: string[] }
  | { type: "onceAtChanged"; value: string }
  | { type: "enabledChanged"; value: boolean };

export type ScheduleFormResult =
  | { ok: true; input: ScheduleInput }
  | { ok: false; message: string };

export function createScheduleFormState(
  schedule?: ScheduleRecord,
): ScheduleFormState {
  if (!schedule) {
    return {
      name: "",
      prompt: "",
      cadenceKind: "daily",
      runAtTime: "09:00",
      weekdays: ["1"],
      onceAt: "",
      enabled: true,
    };
  }

  if (schedule.cadence.kind === "once") {
    return {
      name: schedule.name,
      prompt: schedule.prompt,
      cadenceKind: "once",
      runAtTime: "09:00",
      weekdays: ["1"],
      onceAt: toDateTimeLocalValue(schedule.cadence.at),
      enabled: schedule.enabled,
    };
  }

  return {
    name: schedule.name,
    prompt: schedule.prompt,
    cadenceKind: schedule.cadence.kind,
    runAtTime: `${pad(schedule.cadence.hour)}:${pad(schedule.cadence.minute)}`,
    weekdays:
      schedule.cadence.kind === "weekly"
        ? schedule.cadence.weekdays.map(String)
        : ["1"],
    onceAt: "",
    enabled: schedule.enabled,
  };
}

export function scheduleFormReducer(
  state: ScheduleFormState,
  action: ScheduleFormAction,
): ScheduleFormState {
  switch (action.type) {
    case "reset":
      return createScheduleFormState(action.schedule);
    case "nameChanged":
      return { ...state, name: action.value };
    case "promptChanged":
      return { ...state, prompt: action.value };
    case "cadenceChanged":
      return { ...state, cadenceKind: action.value };
    case "runAtTimeChanged":
      return { ...state, runAtTime: action.value };
    case "weekdaysChanged":
      return { ...state, weekdays: action.value };
    case "onceAtChanged":
      return { ...state, onceAt: action.value };
    case "enabledChanged":
      return { ...state, enabled: action.value };
  }
}

export function scheduleInputFromForm(
  state: ScheduleFormState,
  timeZone: string,
): ScheduleFormResult {
  const onceTimestamp = state.onceAt ? Date.parse(state.onceAt) : Number.NaN;
  if (state.cadenceKind === "once" && !Number.isFinite(onceTimestamp)) {
    return {
      ok: false,
      message: "Choose a valid time for the one-time schedule.",
    };
  }

  if (state.cadenceKind === "weekly" && state.weekdays.length === 0) {
    return {
      ok: false,
      message: "Choose at least one weekday for the weekly schedule.",
    };
  }

  const [hour, minute] = state.runAtTime.split(":").map(Number);
  const cadence: ScheduleCadence =
    state.cadenceKind === "once"
      ? { kind: "once", at: new Date(onceTimestamp).toISOString() }
      : state.cadenceKind === "weekly"
        ? {
            kind: "weekly",
            weekdays: state.weekdays.map(Number),
            hour,
            minute,
            timeZone,
          }
        : { kind: "daily", hour, minute, timeZone };

  return {
    ok: true,
    input: {
      name: state.name.trim(),
      prompt: state.prompt.trim(),
      threadId: null,
      cadence,
      enabled: state.enabled,
    },
  };
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
