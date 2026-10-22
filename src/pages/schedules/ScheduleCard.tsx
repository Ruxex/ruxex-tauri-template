import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import type { ScheduleRecord } from "../../platform/schedules";
import { formatDateTime, scheduleCadenceLabel } from "./schedule-format";

export function EmptyScheduleList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-base-300 bg-base-100/50 px-6 py-10 text-center">
      <CalendarDaysIcon
        aria-hidden="true"
        className="mx-auto size-8 text-base-content/35"
      />
      <h3 className="mt-3 font-semibold">No schedules yet</h3>
      <p className="mt-1 text-sm text-base-content/60">
        Create your first schedule to automate a prompt.
      </p>
      <button
        className="btn btn-sm btn-primary mt-4"
        type="button"
        onClick={onCreate}
      >
        <PlusIcon aria-hidden="true" className="size-4" />
        Create schedule
      </button>
    </div>
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
    <article className="group flex min-h-52 flex-col justify-between rounded-xl border border-base-300 bg-base-100 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-content">
            <CalendarDaysIcon aria-hidden="true" className="size-5" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <button
            aria-label={`Run now: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square"
            disabled={isRunPending}
            title="Run now"
            onClick={() => onRequestAction("run", schedule)}
            type="button"
          >
            <PlayIcon aria-hidden="true" className="size-4" />
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
      <button
        aria-label={`Edit schedule: ${schedule.name}`}
        className="mt-5 block w-full text-left"
        type="button"
        onClick={() => onEdit(schedule)}
      >
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{schedule.name}</h3>
          <p className="mt-1 text-sm text-base-content/60">
            {scheduleCadenceLabel(schedule.cadence)}
          </p>
          <p className="mt-3 text-sm leading-6 text-base-content/75">
            {schedule.prompt}
          </p>
        </div>
        <div className="mt-4 space-y-1 text-xs text-base-content/60">
          <p>Next run: {formatDateTime(schedule.nextRunAt)}</p>
          {schedule.threadId && (
            <p className="truncate font-mono">Thread: {schedule.threadId}</p>
          )}
        </div>
        {schedule.lastRun && (
          <p
            className={`mt-3 flex items-start gap-2 text-sm ${schedule.lastRun.success ? "text-success" : "text-error"}`}
          >
            {schedule.lastRun.success ? (
              <CheckCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            ) : (
              <ExclamationCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            )}
            <span>
              {schedule.lastRun.success
                ? "Last run succeeded"
                : `Last run failed: ${schedule.lastRun.message}`}
            </span>
          </p>
        )}
      </button>
    </article>
  );
}
