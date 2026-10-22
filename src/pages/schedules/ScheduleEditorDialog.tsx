import type { Dispatch, FormEvent } from "react";
import {
  CalendarDaysIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import type { ScheduleFormAction, ScheduleFormState } from "./schedule-form";
import {
  cadenceLabel,
  systemTimeZoneLabel,
  TIME_OPTIONS,
  WEEKDAYS,
} from "./schedule-format";

export function ScheduleEditorDialog({
  form,
  dispatch,
  isEditing,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  form: ScheduleFormState;
  dispatch: Dispatch<ScheduleFormAction>;
  isEditing: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <dialog
      aria-labelledby="schedule-dialog-title"
      className="modal"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl px-5 py-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDaysIcon aria-hidden="true" className="size-5" />
            </div>
            <h2 className="font-semibold" id="schedule-dialog-title">
              {isEditing ? "Edit schedule" : "Create a schedule"}
            </h2>
          </div>
          <button
            aria-label="Close schedule dialog"
            className="btn btn-ghost btn-sm btn-square"
            type="button"
            onClick={onClose}
          >
            <XMarkIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="form-control">
            <input
              aria-label="Schedule name"
              className="input input-bordered mt-1 w-full"
              onChange={(event) =>
                dispatch({ type: "nameChanged", value: event.target.value })
              }
              placeholder="e.g. Morning checks"
              value={form.name}
            />
          </label>
          <label className="form-control">
            <textarea
              aria-label="Instructions"
              className="textarea textarea-bordered mt-1 min-h-28 w-full"
              onChange={(event) =>
                dispatch({ type: "promptChanged", value: event.target.value })
              }
              placeholder="Enter instructions…"
              value={form.prompt}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <select
                aria-label="Cadence"
                className="select select-bordered mt-1 w-full"
                onChange={(event) =>
                  dispatch({
                    type: "cadenceChanged",
                    value: event.target
                      .value as ScheduleFormState["cadenceKind"],
                  })
                }
                value={form.cadenceKind}
              >
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="once">One time</option>
              </select>
            </label>
            {form.cadenceKind === "weekly" && (
              <label className="form-control">
                <select
                  aria-label="Weekday"
                  className="select select-bordered mt-1 w-full"
                  onChange={(event) =>
                    dispatch({
                      type: "weekdayChanged",
                      value: event.target.value,
                    })
                  }
                  value={form.weekday}
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {form.cadenceKind === "once" ? (
            <label className="form-control">
              <input
                aria-label="Run at"
                className="input input-bordered mt-1 w-full"
                onChange={(event) =>
                  dispatch({ type: "onceAtChanged", value: event.target.value })
                }
                type="datetime-local"
                value={form.onceAt}
              />
            </label>
          ) : (
            <label className="form-control">
              <select
                aria-label="Run time"
                className="select select-bordered mt-1 w-full"
                onChange={(event) =>
                  dispatch({
                    type: "runAtTimeChanged",
                    value: event.target.value,
                  })
                }
                value={form.runAtTime}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-base-300 px-3 py-3">
            <div>
              <p className="text-sm font-medium">Schedule status</p>
              <p className="text-xs text-base-content/60">
                {form.enabled ? "Runs automatically" : "Paused until enabled"}
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <span>{form.enabled ? "Enabled" : "Disabled"}</span>
              <input
                aria-label="Enable schedule"
                checked={form.enabled}
                className="toggle toggle-primary toggle-sm"
                onChange={(event) =>
                  dispatch({
                    type: "enabledChanged",
                    value: event.target.checked,
                  })
                }
                type="checkbox"
              />
            </label>
          </div>
          <div
            aria-live="polite"
            className="rounded-lg bg-base-200/60 px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <CalendarDaysIcon
                aria-hidden="true"
                className="size-5 text-primary"
              />
              <p className="text-base font-semibold">{cadenceLabel(form)}</p>
            </div>
            <p className="mt-1 pl-7 text-xs text-base-content/60">
              System timezone: {systemTimeZoneLabel()}
            </p>
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button
              className="btn btn-primary min-h-11 gap-2"
              disabled={isPending}
              type="submit"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {isEditing
                ? isPending
                  ? "Saving…"
                  : "Save changes"
                : isPending
                  ? "Creating…"
                  : "Create schedule"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          aria-label="Close schedule dialog"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </form>
    </dialog>
  );
}
