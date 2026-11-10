import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { EmptyState } from "../../components/common/AsyncState";
import type { ScheduleRecord } from "../../platform/schedules";
import { formatDateTime, scheduleCadenceLabel } from "./schedule-format";

export function EmptyScheduleList({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      action={
        <button
          aria-label="Create schedule"
          className="btn btn-sm btn-primary"
          type="button"
          onClick={onCreate}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          Create schedule
        </button>
      }
      description="Create your first schedule to automate a prompt."
      icon={CalendarDaysIcon}
      title="No schedules yet"
    />
  );
}

export function ScheduleCard({
  schedule,
  isTogglePending,
  isRunPending,
  isDeletePending,
  onEnabledChange,
  onEdit,
  onRequestAction,
}: {
  schedule: ScheduleRecord;
  isTogglePending: boolean;
  isRunPending: boolean;
  isDeletePending: boolean;
  onEnabledChange: (schedule: ScheduleRecord, enabled: boolean) => void;
  onEdit: (schedule: ScheduleRecord) => void;
  onRequestAction: (action: "run" | "delete", schedule: ScheduleRecord) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-content">
            <CalendarDaysIcon aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
              Automation
            </p>
            <h3 className="truncate font-semibold">{schedule.name}</h3>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-base-content/70">
          <span>{schedule.enabled ? "Enabled" : "Disabled"}</span>
          <input
            aria-label={`${schedule.enabled ? "Disable" : "Enable"} schedule: ${schedule.name}`}
            checked={schedule.enabled}
            className="toggle toggle-primary toggle-sm"
            disabled={isTogglePending}
            onChange={(event) =>
              onEnabledChange(schedule, event.target.checked)
            }
            type="checkbox"
          />
        </label>
      </div>
      <button
        aria-label={`Edit schedule: ${schedule.name}`}
        className="mx-4 block w-[calc(100%-2rem)] rounded-lg border border-base-300 bg-base-200/50 p-3 text-left transition hover:border-primary/40 hover:bg-base-200"
        type="button"
        onClick={() => onEdit(schedule)}
      >
        <div className="flex items-start gap-3">
          <CalendarDaysIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
              Schedule
            </p>
            <p className="mt-1 font-medium">
              {scheduleCadenceLabel(schedule.cadence)}
            </p>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-base-content/70">
              {schedule.prompt}
            </p>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-base-300 px-4 py-3">
        <div className="min-w-0 space-y-1 text-xs text-base-content/60">
          <p className="truncate">
            Next run: {formatDateTime(schedule.nextRunAt)}
          </p>
          {schedule.threadId && (
            <p className="truncate font-mono">Thread: {schedule.threadId}</p>
          )}
          {schedule.lastRun && (
            <p
              className={`flex items-center gap-1.5 text-xs ${schedule.lastRun.success ? "text-success" : "text-error"}`}
            >
              {schedule.lastRun.success ? (
                <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <ExclamationCircleIcon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
              )}
              <span className="truncate">
                {schedule.lastRun.success
                  ? "Last run succeeded"
                  : `Last run failed: ${schedule.lastRun.message}`}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`Run now: ${schedule.name}`}
            className="btn btn-outline btn-sm gap-1.5"
            disabled={isRunPending}
            onClick={() => onRequestAction("run", schedule)}
            type="button"
          >
            <PlayIcon aria-hidden="true" className="size-4" />
            Run now
          </button>
          <button
            aria-label={`Delete: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
            disabled={isDeletePending}
            title="Delete"
            onClick={() => onRequestAction("delete", schedule)}
            type="button"
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
