import { type FormEvent, useState } from "react";

import { useSchedules } from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import type { ScheduleCadence } from "../platform/schedules";

export function SchedulesPage() {
  const schedules = useSchedules();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [threadId, setThreadId] = useState("");
  const [cadenceKind, setCadenceKind] = useState<"daily" | "weekly" | "once">(
    "daily",
  );
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [weekday, setWeekday] = useState("1");
  const [onceAt, setOnceAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const onceTimestamp = onceAt ? Date.parse(onceAt) : Number.NaN;
    if (cadenceKind === "once" && !Number.isFinite(onceTimestamp)) {
      setFormError("Choose a valid time for the one-time schedule.");
      return;
    }
    const cadence: ScheduleCadence =
      cadenceKind === "once"
        ? { kind: "once", at: new Date(onceTimestamp).toISOString() }
        : cadenceKind === "weekly"
          ? {
              kind: "weekly",
              weekday: Number(weekday),
              hour: Number(hour),
              minute: Number(minute),
            }
          : { kind: "daily", hour: Number(hour), minute: Number(minute) };
    schedules.create.mutate({
      name: name.trim(),
      prompt: prompt.trim(),
      threadId: threadId.trim() || null,
      cadence,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Automation
        </p>
        <h1 className="text-3xl font-semibold">Schedules</h1>
        <p className="mt-2 text-sm text-base-content/70">
          Persisted schedules resume an existing thread when a Thread ID is
          supplied, including over a remote App Server connection.
        </p>
      </div>
      {!isDesktopRuntime && (
        <p className="alert alert-info">
          Schedules are available in the Tauri desktop runtime.
        </p>
      )}
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title">Create schedule</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={create}>
            <label className="form-control">
              <span className="label-text">Schedule name</span>
              <input
                aria-label="Schedule name"
                className="input input-bordered input-sm mt-1"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Thread ID (optional)</span>
              <input
                aria-label="Thread ID (optional)"
                className="input input-bordered input-sm mt-1"
                onChange={(event) => setThreadId(event.target.value)}
                value={threadId}
              />
            </label>
            <label className="form-control md:col-span-2">
              <span className="label-text">Prompt</span>
              <textarea
                aria-label="Prompt"
                className="textarea textarea-bordered mt-1"
                onChange={(event) => setPrompt(event.target.value)}
                value={prompt}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Cadence</span>
              <select
                aria-label="Cadence"
                className="select select-bordered select-sm mt-1"
                onChange={(event) =>
                  setCadenceKind(event.target.value as typeof cadenceKind)
                }
                value={cadenceKind}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="once">Once</option>
              </select>
            </label>
            {cadenceKind === "once" ? (
              <label className="form-control">
                <span className="label-text">Run at</span>
                <input
                  aria-label="Run at"
                  className="input input-bordered input-sm mt-1"
                  onChange={(event) => setOnceAt(event.target.value)}
                  type="datetime-local"
                  value={onceAt}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {cadenceKind === "weekly" && (
                  <label className="form-control">
                    <span className="label-text">Weekday</span>
                    <select
                      aria-label="Weekday"
                      className="select select-bordered select-sm mt-1"
                      onChange={(event) => setWeekday(event.target.value)}
                      value={weekday}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </label>
                )}
                <label className="form-control">
                  <span className="label-text">Hour</span>
                  <input
                    aria-label="Hour"
                    className="input input-bordered input-sm mt-1"
                    max="23"
                    min="0"
                    onChange={(event) => setHour(event.target.value)}
                    type="number"
                    value={hour}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Minute</span>
                  <input
                    aria-label="Minute"
                    className="input input-bordered input-sm mt-1"
                    max="59"
                    min="0"
                    onChange={(event) => setMinute(event.target.value)}
                    type="number"
                    value={minute}
                  />
                </label>
              </div>
            )}
            {formError && (
              <p className="text-sm text-error md:col-span-2" role="alert">
                {formError}
              </p>
            )}
            <button
              className="btn btn-primary md:col-span-2 md:justify-self-end"
              disabled={schedules.create.isPending}
              type="submit"
            >
              {schedules.create.isPending ? "Creating…" : "Create schedule"}
            </button>
          </form>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Saved schedules</h2>
        {schedules.query.isLoading && (
          <span className="loading loading-spinner" />
        )}
        {schedules.query.isError && (
          <p className="alert alert-error">
            Unable to load schedules: {String(schedules.query.error)}
          </p>
        )}
        {!schedules.query.isLoading && !schedules.query.data?.length && (
          <p className="text-sm text-base-content/60">No schedules yet.</p>
        )}
        {schedules.query.data?.map((schedule) => (
          <article
            className="card border border-base-300 bg-base-100 shadow-sm"
            key={schedule.id}
          >
            <div className="card-body gap-2">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{schedule.name}</h3>
                  <p className="text-sm text-base-content/70">
                    Next: {schedule.nextRunAt}
                  </p>
                </div>
                <span
                  className={`badge ${schedule.enabled ? "badge-success" : "badge-ghost"}`}
                >
                  {schedule.enabled ? "Enabled" : "Completed"}
                </span>
              </div>
              <p className="text-sm">{schedule.prompt}</p>
              {schedule.threadId && (
                <p className="text-xs text-base-content/60">
                  Continues thread {schedule.threadId}
                </p>
              )}
              {schedule.lastRun && (
                <p
                  className={`text-sm ${schedule.lastRun.success ? "text-success" : "text-error"}`}
                >
                  {schedule.lastRun.success
                    ? "Last run succeeded"
                    : `Last run failed: ${schedule.lastRun.message}`}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  aria-label={`Run now: ${schedule.name}`}
                  className="btn btn-sm btn-outline"
                  disabled={schedules.runNow.isPending}
                  onClick={() => schedules.runNow.mutate(schedule.id)}
                  type="button"
                >
                  Run now
                </button>
                <button
                  aria-label={`Delete: ${schedule.name}`}
                  className="btn btn-sm btn-ghost text-error"
                  disabled={schedules.remove.isPending}
                  onClick={() => schedules.remove.mutate(schedule.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
