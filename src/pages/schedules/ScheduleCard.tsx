import { useTranslation } from "react-i18next";
import { CalendarDaysIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { EmptyState } from "@/components/base/common/AsyncState";
import { ProjectIcon } from "@/components/composite/projects/ProjectIcon";
import { projectColorClassName } from "@/components/composite/projects/project-metadata";
import type { ScheduleRecord } from "@/platform/schedules";
import { formatDateTime, formatRelativeDateTime, scheduleCadenceLabel } from "./schedule-format";

export function EmptyScheduleList({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation("schedules");
  return (
    <EmptyState
      action={
        <button
          aria-label={t("createSchedule")}
          className="btn btn-sm btn-primary gap-1"
          type="button"
          onClick={onCreate}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          {t("createSchedule")}
        </button>
      }
      description={t("createYourFirstScheduleToAutomateAPrompt")}
      icon={CalendarDaysIcon}
      title={t("noSchedulesYet")}
    />
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest("button, input, label, a, select, textarea") !== null;
}

export function ScheduleCard({
  schedule,
  isTogglePending,
  isRunPending,
  isDeletePending,
  onEnabledChange,
  onEdit,
  onOpen,
  onRequestAction,
}: {
  schedule: ScheduleRecord;
  isTogglePending: boolean;
  isRunPending: boolean;
  isDeletePending: boolean;
  onEnabledChange: (schedule: ScheduleRecord, enabled: boolean) => void;
  onEdit: (schedule: ScheduleRecord) => void;
  onOpen?: (schedule: ScheduleRecord) => void;
  onRequestAction: (action: "run" | "delete", schedule: ScheduleRecord) => void;
}) {
  const { t, i18n } = useTranslation("schedules");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";
  const enabledTone = schedule.enabled;

  return (
    <article
      aria-label={onOpen ? t("openNamed", { name: schedule.name }) : undefined}
      className={`group cursor-pointer overflow-hidden rounded-xl border border-base-300 shadow-sm transition-colors duration-200 ${enabledTone ? "bg-base-100 hover:border-primary/50" : "bg-base-200/40 text-base-content/65 hover:border-base-300"}`}
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) onOpen?.(schedule);
      }}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(schedule);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${enabledTone ? projectColorClassName(schedule.color) : "bg-base-200 text-base-content/45"}`}
          >
            <ProjectIcon aria-hidden="true" className="size-5" icon={schedule.icon} />
          </div>
          <div className="min-w-0">
            <h3 className={`truncate font-semibold ${enabledTone ? "text-base-content" : "text-base-content/60"}`}>
              {schedule.name}
            </h3>
            <p className={`mt-1 truncate text-xs ${enabledTone ? "text-base-content/60" : "text-base-content/45"}`}>
              {t("nextRunValue", {
                time: formatDateTime(schedule.nextRunAt, locale),
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={t("editNamed", { name: schedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            title={t("edit")}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(schedule);
            }}
            type="button"
          >
            <PencilIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={t("runNamed", { name: schedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            disabled={isRunPending}
            title={t("runNow")}
            onClick={(event) => {
              event.stopPropagation();
              onRequestAction("run", schedule);
            }}
            type="button"
          >
            <PlayIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={t("deleteNamed", { name: schedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            disabled={isDeletePending}
            title={t("delete")}
            onClick={(event) => {
              event.stopPropagation();
              onRequestAction("delete", schedule);
            }}
            type="button"
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
          <label className="flex shrink-0 items-center">
            <input
              aria-label={t(schedule.enabled ? "disableNamed" : "enableNamed", {
                name: schedule.name,
              })}
              checked={schedule.enabled}
              className="toggle toggle-primary toggle-sm"
              disabled={isTogglePending}
              onChange={(event) => onEnabledChange(schedule, event.target.checked)}
              type="checkbox"
            />
          </label>
        </div>
      </div>
      <div
        className={`mx-4 mb-3 text-sm font-medium ${enabledTone ? "text-base-content/70" : "text-base-content/50"}`}
      >
        {scheduleCadenceLabel(schedule.cadence)}
      </div>
      <div className="mx-4 mb-4 block rounded-lg border border-base-300 bg-base-200/50 p-3 text-left">
        <div className="min-w-0">
          <p
            className={`line-clamp-2 text-sm leading-5 ${enabledTone ? "text-base-content/70" : "text-base-content/50"}`}
          >
            {schedule.prompt}
          </p>
        </div>
      </div>
      {schedule.lastRun && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-base-300 px-4 py-3">
          <div
            className={`min-w-0 space-y-1 text-xs ${enabledTone ? "text-base-content/60" : "text-base-content/45"}`}
          >
            <p className="truncate" title={formatDateTime(schedule.lastRun.at, locale)}>
              {t("lastRunValue", {
                time: formatRelativeDateTime(schedule.lastRun.at),
              })}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
