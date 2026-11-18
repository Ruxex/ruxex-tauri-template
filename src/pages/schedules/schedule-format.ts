import { i18n } from "@/app/i18n";
import { dateTimeFormatter, type UiLocale } from "@/app/locale-format";
import type { ScheduleCadence } from "@/platform/schedules";
import type { ScheduleFormState } from "./schedule-form";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

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
      ? i18n.t("oneTimeAt", {
          ns: "schedules",
          lng: i18n.resolvedLanguage,
          time: formatDateTime(state.onceAt),
        })
      : i18n.t("oneTimeSchedule", {
          ns: "schedules",
          lng: i18n.resolvedLanguage,
        });
  }
  const time = state.runAtTime || "09:00";
  return state.cadenceKind === "weekly"
    ? i18n.t("weeklyAt", {
        ns: "schedules",
        lng: i18n.resolvedLanguage,
        weekdays: weekdayLabel(state.weekdays.map(Number)),
        time,
      })
    : i18n.t("dailyAt", { ns: "schedules", lng: i18n.resolvedLanguage, time });
}

export function scheduleCadenceLabel(cadence: ScheduleCadence) {
  if (cadence.kind === "once") {
    return i18n.t("oneTimeAt", {
      ns: "schedules",
      lng: i18n.resolvedLanguage,
      time: formatDateTime(cadence.at),
    });
  }
  const time = `${String(cadence.hour).padStart(2, "0")}:${String(cadence.minute).padStart(2, "0")}`;
  return cadence.kind === "weekly"
    ? i18n.t("weeklyAt", {
        ns: "schedules",
        lng: i18n.resolvedLanguage,
        weekdays: weekdayLabel(cadence.weekdays),
        time,
      })
    : i18n.t("dailyAt", { ns: "schedules", lng: i18n.resolvedLanguage, time });
}

function weekdayLabel(weekdays: readonly number[]) {
  const labels = weekdays
    .map((weekday) => (WEEKDAYS[weekday] ? weekdayName(WEEKDAYS[weekday]) : undefined))
    .filter((weekday): weekday is (typeof WEEKDAYS)[number] => Boolean(weekday));
  return labels.length > 0 ? labels.join(", ") : i18n.t("week", { ns: "schedules", lng: i18n.resolvedLanguage });
}

export function formatDateTime(value: string, locale: UiLocale = i18n.resolvedLanguage === "ja" ? "ja" : "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatRelativeDateTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return i18n.t("justNow", { ns: "schedules", lng: i18n.resolvedLanguage });
  if (elapsedSeconds < 60 * 60) {
    return relativeCount(Math.floor(elapsedSeconds / 60), "minute");
  }
  if (elapsedSeconds < 60 * 60 * 24) {
    return relativeCount(Math.floor(elapsedSeconds / (60 * 60)), "hour");
  }
  if (elapsedSeconds < 60 * 60 * 24 * 7) {
    return relativeCount(Math.floor(elapsedSeconds / (60 * 60 * 24)), "day");
  }

  return formatDateTime(value);
}

function relativeCount(value: number, unit: string) {
  return i18n.t(`relative.${unit}`, {
    ns: "schedules",
    lng: i18n.resolvedLanguage,
    count: value,
  });
}

export function browserTimeZone() {
  return dateTimeFormatter("en").resolvedOptions().timeZone || "UTC";
}

export function systemTimeZoneLabel(locale: UiLocale = i18n.resolvedLanguage === "ja" ? "ja" : "en") {
  const timeZone = browserTimeZone();
  const timeZoneName = dateTimeFormatter(locale, {
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") return timeZone;
  return `${timeZoneName} (${timeZone})`;
}

export function weekdayName(day: (typeof WEEKDAYS)[number]): string {
  return i18n.t(`weekdays.${day.toLowerCase()}`, {
    ns: "schedules",
    lng: i18n.resolvedLanguage,
  });
}
