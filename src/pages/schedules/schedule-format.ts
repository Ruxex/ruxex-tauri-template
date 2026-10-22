import type { ScheduleCadence } from "../../platform/schedules";
import type { ScheduleFormState } from "./schedule-form";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4)
    .toString()
    .padStart(2, "0");
  const minute = ((index % 4) * 15).toString().padStart(2, "0");
  return `${hour}:${minute}`;
});

export function cadenceLabel(state: ScheduleFormState) {
  if (state.cadenceKind === "once") {
    return state.onceAt
      ? `One time · ${formatDateTime(state.onceAt)}`
      : "One time schedule";
  }
  const time = state.runAtTime || "09:00";
  return state.cadenceKind === "weekly"
    ? `Every ${WEEKDAYS[Number(state.weekday)] ?? "week"} · ${time}`
    : `Every day · ${time}`;
}

export function scheduleCadenceLabel(cadence: ScheduleCadence) {
  if (cadence.kind === "once") {
    return `One time · ${formatDateTime(cadence.at)}`;
  }
  const time = `${String(cadence.hour).padStart(2, "0")}:${String(cadence.minute).padStart(2, "0")}`;
  return cadence.kind === "weekly"
    ? `Every ${WEEKDAYS[cadence.weekday] ?? "week"} · ${time}`
    : `Every day · ${time}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function systemTimeZoneLabel() {
  const timeZone = browserTimeZone();
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") return timeZone;
  return `${timeZoneName} (${timeZone})`;
}
