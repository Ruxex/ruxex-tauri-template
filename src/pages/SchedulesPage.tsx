import { type FormEvent, useState } from "react";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../app/error-message";
import { useSchedules } from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import type { ScheduleCadence, ScheduleRecord } from "../platform/schedules";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4)
    .toString()
    .padStart(2, "0");
  const minute = ((index % 4) * 15).toString().padStart(2, "0");
  return `${hour}:${minute}`;
});

export function SchedulesPage() {
  const schedules = useSchedules();
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(
    null,
  );
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadenceKind, setCadenceKind] = useState<"daily" | "weekly" | "once">(
    "daily",
  );
  const [runAtTime, setRunAtTime] = useState("09:00");
  const [weekday, setWeekday] = useState("1");
  const [onceAt, setOnceAt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: "run" | "delete";
    schedule: ScheduleRecord;
  } | null>(null);

  const isScheduleModalOpen = isCreatePanelOpen || editingSchedule !== null;

  function openCreatePanel() {
    setEditingSchedule(null);
    setName("");
    setPrompt("");
    setCadenceKind("daily");
    setRunAtTime("09:00");
    setWeekday("1");
    setOnceAt("");
    setEnabled(true);
    setFormError(null);
    setIsCreatePanelOpen(true);
  }

  function openEditPanel(schedule: ScheduleRecord) {
    setEditingSchedule(schedule);
    setIsCreatePanelOpen(false);
    setName(schedule.name);
    setPrompt(schedule.prompt);
    setEnabled(schedule.enabled);
    setFormError(null);
    if (schedule.cadence.kind === "once") {
      setCadenceKind("once");
      setRunAtTime("09:00");
      setWeekday("1");
      setOnceAt(toDateTimeLocalValue(schedule.cadence.at));
    } else {
      setCadenceKind(schedule.cadence.kind);
      setRunAtTime(
        `${String(schedule.cadence.hour).padStart(2, "0")}:${String(schedule.cadence.minute).padStart(2, "0")}`,
      );
      setWeekday(
        schedule.cadence.kind === "weekly"
          ? String(schedule.cadence.weekday)
          : "1",
      );
      setOnceAt("");
    }
  }

  function closeCreatePanel() {
    setIsCreatePanelOpen(false);
    setEditingSchedule(null);
    setFormError(null);
  }

  function closeActionConfirmation() {
    setPendingAction(null);
  }

  function confirmAction() {
    if (!pendingAction) return;
    const onSuccess = closeActionConfirmation;
    if (pendingAction.kind === "run") {
      schedules.runNow.mutate(pendingAction.schedule.id, { onSuccess });
    } else {
      schedules.remove.mutate(pendingAction.schedule.id, { onSuccess });
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const onceTimestamp = onceAt ? Date.parse(onceAt) : Number.NaN;
    if (cadenceKind === "once" && !Number.isFinite(onceTimestamp)) {
      setFormError("Choose a valid time for the one-time schedule.");
      return;
    }
    const [hourValue, minuteValue] = runAtTime.split(":").map(Number);
    const cadence: ScheduleCadence =
      cadenceKind === "once"
        ? { kind: "once", at: new Date(onceTimestamp).toISOString() }
        : cadenceKind === "weekly"
          ? {
              kind: "weekly",
              weekday: Number(weekday),
              hour: hourValue,
              minute: minuteValue,
            }
          : { kind: "daily", hour: hourValue, minute: minuteValue };
    const input = {
      name: name.trim(),
      prompt: prompt.trim(),
      threadId: null,
      cadence,
    };
    const finishSave = () => {
      setName("");
      setPrompt("");
      closeCreatePanel();
    };
    if (editingSchedule) {
      schedules.update.mutate(
        { id: editingSchedule.id, input },
        {
          onSuccess: () => {
            if (editingSchedule.enabled !== enabled) {
              schedules.setEnabled.mutate(
                { id: editingSchedule.id, enabled },
                { onSuccess: finishSave },
              );
            } else {
              finishSave();
            }
          },
        },
      );
    } else {
      schedules.create.mutate(input, {
        onSuccess: (createdSchedule) => {
          if (!enabled) {
            schedules.setEnabled.mutate(
              { id: createdSchedule.id, enabled: false },
              { onSuccess: finishSave },
            );
          } else {
            finishSave();
          }
        },
      });
    }
  }

  const savedSchedules = schedules.query.data ?? [];
  const actionError = schedules.runNow.isError
    ? `Unable to run schedule: ${formatErrorMessage(schedules.runNow.error)}`
    : schedules.remove.isError
      ? `Unable to delete schedule: ${formatErrorMessage(schedules.remove.error)}`
      : schedules.setEnabled.isError
        ? `Unable to update schedule status: ${formatErrorMessage(schedules.setEnabled.error)}`
      : null;

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Automation</h1>
        </div>
        <button
          aria-expanded={isScheduleModalOpen}
          className="btn btn-primary min-h-11 gap-2"
          type="button"
          onClick={() =>
            isScheduleModalOpen ? closeCreatePanel() : openCreatePanel()
          }
        >
          {isScheduleModalOpen ? (
            <XMarkIcon aria-hidden="true" className="size-4" />
          ) : (
            <PlusIcon aria-hidden="true" className="size-4" />
          )}
          {isScheduleModalOpen ? "Close" : "New schedule"}
        </button>
      </header>

      {!isDesktopRuntime && (
        <p className="alert alert-info text-sm">
          Schedules are available in the Tauri desktop runtime.
        </p>
      )}

      {isScheduleModalOpen && (
        <dialog
          aria-labelledby="schedule-dialog-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            closeCreatePanel();
          }}
        >
          <div className="modal-box w-full max-w-2xl px-5 py-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDaysIcon aria-hidden="true" className="size-5" />
                </div>
                <h2 className="font-semibold" id="schedule-dialog-title">
                  {editingSchedule ? "Edit schedule" : "Create a schedule"}
                </h2>
              </div>
              <button
                aria-label="Close schedule dialog"
                className="btn btn-ghost btn-sm btn-square"
                type="button"
                onClick={closeCreatePanel}
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            <form className="grid gap-3" onSubmit={save}>
              <label className="form-control">
                <input
                  aria-label="Schedule name"
                  className="input input-bordered mt-1 w-full"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Morning checks"
                  value={name}
                />
              </label>
              <label className="form-control">
                <textarea
                  aria-label="Instructions"
                  className="textarea textarea-bordered mt-1 min-h-28 w-full"
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Enter instructions…"
                  value={prompt}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="form-control">
                  <select
                    aria-label="Cadence"
                    className="select select-bordered mt-1 w-full"
                    onChange={(event) =>
                      setCadenceKind(event.target.value as typeof cadenceKind)
                    }
                    value={cadenceKind}
                  >
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week</option>
                    <option value="once">One time</option>
                  </select>
                </label>
                {cadenceKind === "weekly" && (
                  <label className="form-control">
                    <select
                      aria-label="Weekday"
                      className="select select-bordered mt-1 w-full"
                      onChange={(event) => setWeekday(event.target.value)}
                      value={weekday}
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
              {cadenceKind === "once" ? (
                <label className="form-control">
                  <input
                    aria-label="Run at"
                    className="input input-bordered mt-1 w-full"
                    onChange={(event) => setOnceAt(event.target.value)}
                    type="datetime-local"
                    value={onceAt}
                  />
                </label>
              ) : (
                <label className="form-control">
                  <select
                    aria-label="Run time"
                    className="select select-bordered mt-1 w-full"
                    onChange={(event) => setRunAtTime(event.target.value)}
                    value={runAtTime}
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
                    {enabled ? "Runs automatically" : "Paused until enabled"}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <span>{enabled ? "Enabled" : "Disabled"}</span>
                  <input
                    aria-label="Enable schedule"
                    checked={enabled}
                    className="toggle toggle-primary toggle-sm"
                    onChange={(event) => setEnabled(event.target.checked)}
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
                  <p className="text-base font-semibold">
                    {cadenceLabel(cadenceKind, runAtTime, weekday, onceAt)}
                  </p>
                </div>
                <p className="mt-1 pl-7 text-xs text-base-content/60">
                  System timezone: {systemTimeZoneLabel()}
                </p>
              </div>
              {formError && (
                <p className="text-sm text-error" role="alert">
                  {formError}
                </p>
              )}
              {(editingSchedule
                ? schedules.update.isError
                : schedules.create.isError) && (
                <p className="text-sm text-error" role="alert">
                  Unable to {editingSchedule ? "update" : "create"} schedule: {formatErrorMessage(
                    editingSchedule
                      ? schedules.update.error
                      : schedules.create.error,
                  )}
                </p>
              )}
              {schedules.setEnabled.isError && (
                <p className="text-sm text-error" role="alert">
                  Unable to update schedule status: {formatErrorMessage(schedules.setEnabled.error)}
                </p>
              )}
              <div className="flex justify-end pt-2">
                <button
                  className="btn btn-primary min-h-11 gap-2"
                  disabled={
                    editingSchedule
                      ? schedules.update.isPending || schedules.setEnabled.isPending
                      : schedules.create.isPending || schedules.setEnabled.isPending
                  }
                  type="submit"
                >
                  <PlusIcon aria-hidden="true" className="size-4" />
                  {editingSchedule
                    ? schedules.update.isPending
                      ? "Saving…"
                      : "Save changes"
                    : schedules.create.isPending
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
              onClick={closeCreatePanel}
            >
              Close
            </button>
          </form>
        </dialog>
      )}

      {pendingAction && (
        <dialog
          aria-labelledby="schedule-action-dialog-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            closeActionConfirmation();
          }}
        >
          <div className="modal-box w-full max-w-md px-5 py-6">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <ExclamationTriangleIcon
                  aria-hidden="true"
                  className="size-5"
                />
              </div>
              <div>
                <h2 className="font-semibold" id="schedule-action-dialog-title">
                  {pendingAction.kind === "run"
                    ? "Run schedule now?"
                    : "Delete schedule?"}
                </h2>
                <p className="mt-2 text-sm text-base-content/70">
                  {pendingAction.kind === "run"
                    ? `Run “${pendingAction.schedule.name}” immediately?`
                    : `Delete “${pendingAction.schedule.name}”? This cannot be undone.`}
                </p>
              </div>
            </div>
            {(pendingAction.kind === "run"
              ? schedules.runNow.isError
              : schedules.remove.isError) && (
              <p className="mt-4 text-sm text-error" role="alert">
                {pendingAction.kind === "run"
                  ? formatErrorMessage(schedules.runNow.error)
                  : formatErrorMessage(schedules.remove.error)}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={closeActionConfirmation}
              >
                Cancel
              </button>
              <button
                className={`btn ${pendingAction.kind === "delete" ? "btn-error" : "btn-primary"}`}
                disabled={
                  pendingAction.kind === "run"
                    ? schedules.runNow.isPending
                    : schedules.remove.isPending
                }
                type="button"
                onClick={confirmAction}
              >
                {pendingAction.kind === "run" ? "Run now" : "Delete"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeActionConfirmation}>
              Close
            </button>
          </form>
        </dialog>
      )}

      <section aria-labelledby="schedule-list-heading">
        <div className="flex items-end justify-between gap-4 border-b border-base-300 pb-3">
          <div>
            <h2 className="text-lg font-semibold" id="schedule-list-heading">
              Your schedules
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {savedSchedules.length} schedule
              {savedSchedules.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {actionError && (
          <p className="mt-4 text-sm text-error" role="alert">
            {actionError}
          </p>
        )}
        {schedules.query.isLoading && (
          <div className="flex items-center gap-3 pt-4 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            Loading schedules…
          </div>
        )}
        {schedules.query.isError && (
          <p className="pt-4 text-sm text-error">
            Unable to load schedules: {formatErrorMessage(schedules.query.error)}
          </p>
        )}
        {!schedules.query.isLoading && !schedules.query.data?.length && (
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
              onClick={openCreatePanel}
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              Create schedule
            </button>
          </div>
        )}
        <div className="grid gap-3 pt-4 sm:grid-cols-2">
          {schedules.query.data?.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              schedules={schedules}
              onEdit={openEditPanel}
              onRequestAction={(kind, target) =>
                setPendingAction({ kind, schedule: target })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleCard({
  schedule,
  schedules,
  onEdit,
  onRequestAction,
}: {
  schedule: ScheduleRecord;
  schedules: ReturnType<typeof useSchedules>;
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
            disabled={schedules.setEnabled.isPending}
            onChange={(event) =>
              schedules.setEnabled.mutate({
                id: schedule.id,
                enabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          <button
            aria-label={`Run now: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.runNow.isPending}
            title="Run now"
            onClick={() => onRequestAction("run", schedule)}
            type="button"
          >
            <PlayIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Delete: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
            disabled={schedules.remove.isPending}
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

function cadenceLabel(
  cadenceKind: "daily" | "weekly" | "once",
  runAtTime: string,
  weekday: string,
  onceAt: string,
) {
  if (cadenceKind === "once") {
    return onceAt ? `One time · ${formatDateTime(onceAt)}` : "One time schedule";
  }
  const time = runAtTime || "09:00";
  return cadenceKind === "weekly"
    ? `Every ${WEEKDAYS[Number(weekday)] ?? "week"} · ${time}`
    : `Every day · ${time}`;
}

function scheduleCadenceLabel(cadence: ScheduleCadence) {
  if (cadence.kind === "once") {
    return `One time · ${formatDateTime(cadence.at)}`;
  }
  const time = `${String(cadence.hour).padStart(2, "0")}:${String(cadence.minute).padStart(2, "0")}`;
  return cadence.kind === "weekly"
    ? `Every ${WEEKDAYS[cadence.weekday] ?? "week"} · ${time}`
    : `Every day · ${time}`;
}

function formatDateTime(value: string) {
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

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function systemTimeZoneLabel() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZone) return timeZoneName ?? "System timezone";
  if (!timeZoneName || timeZoneName === "GMT") return timeZone;
  return `${timeZoneName} (${timeZone})`;
}
