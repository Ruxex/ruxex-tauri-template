import { useTranslation } from "react-i18next";
import { CalendarDaysIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { Dispatch, FormEvent } from "react";

import {
  DialogFooter,
  DialogHeader,
} from "../../components/common/DialogParts";
import { useNativeModalDialog } from "../../components/common/useNativeModalDialog";
import { ProjectMetadataFields } from "../../components/projects/ProjectMetadataFields";
import type { ScheduleFormAction, ScheduleFormState } from "./schedule-form";
import {
  cadenceLabel,
  systemTimeZoneLabel,
  TIME_OPTIONS,
  WEEKDAYS,
  weekdayName,
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
  const { t } = useTranslation("schedules");
  const dialogRef = useNativeModalDialog();
  return (
    <dialog
      aria-labelledby="schedule-dialog-title"
      className="modal"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl px-5 py-7">
        <DialogHeader
          closeLabel={t("closeScheduleDialog")}
          icon={CalendarDaysIcon}
          onClose={onClose}
          title={isEditing ? t("editSchedule") : t("createASchedule")}
          titleId="schedule-dialog-title"
        />

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="form-control">
            <input
              aria-label={t("scheduleName")}
              className="input input-bordered mt-1 w-full"
              onChange={(event) =>
                dispatch({ type: "nameChanged", value: event.target.value })
              }
              placeholder={t("egMorningChecks")}
              value={form.name}
            />
          </label>
          <label className="form-control">
            <textarea
              aria-label={t("instructions")}
              className="textarea textarea-bordered mt-1 min-h-28 w-full"
              onChange={(event) =>
                dispatch({ type: "promptChanged", value: event.target.value })
              }
              placeholder={t("enterInstructions")}
              value={form.prompt}
            />
          </label>
          <ProjectMetadataFields
            entityLabel={t("automation")}
            value={form.metadata}
            onChange={(metadata) =>
              dispatch({ type: "metadataChanged", value: metadata })
            }
          />
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="form-control">
              <select
                aria-label={t("cadence")}
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
                {isEditing && form.cadenceKind === "once" && (
                  <option value="once">{t("oneTime")}</option>
                )}
                <option value="daily">{t("everyDay")}</option>
                <option value="weekly">{t("everyWeek")}</option>
              </select>
            </label>
            <div className="form-control">
              {form.cadenceKind === "once" ? (
                <input
                  aria-label={t("runAt")}
                  className="input input-bordered mt-1 w-full"
                  onChange={(event) =>
                    dispatch({
                      type: "onceAtChanged",
                      value: event.target.value,
                    })
                  }
                  type="datetime-local"
                  value={form.onceAt}
                />
              ) : (
                <select
                  aria-label={t("runTime")}
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
              )}
            </div>
            {form.cadenceKind === "weekly" && (
              <fieldset className="form-control col-span-2">
                <legend className="text-sm">{t("weekdaySelection")}</legend>
                <div className="mx-auto mt-2 grid grid-cols-7 justify-items-center gap-2 rounded-lg border border-base-300 p-2">
                  {WEEKDAYS.map((day, index) => (
                    <button
                      aria-pressed={form.weekdays.includes(String(index))}
                      aria-label={weekdayName(day)}
                      className={`btn btn-sm size-11 rounded-full p-0 text-sm font-semibold ${form.weekdays.includes(String(index)) ? "btn-primary" : "btn-ghost border border-base-300 bg-base-100"}`}
                      key={day}
                      title={weekdayName(day)}
                      type="button"
                      onClick={() => {
                        const value = String(index);
                        const weekdays = form.weekdays.includes(value)
                          ? form.weekdays.filter((weekday) => weekday !== value)
                          : [...form.weekdays, value].sort(
                              (left, right) => Number(left) - Number(right),
                            );
                        dispatch({
                          type: "weekdaysChanged",
                          value: weekdays,
                        });
                      }}
                    >
                      {weekdayName(day).slice(0, 1)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
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
              {t("systemTimezoneValue", { timezone: systemTimeZoneLabel() })}
            </p>
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              aria-label={
                isEditing
                  ? isPending
                    ? t("saving")
                    : t("saveChanges")
                  : isPending
                    ? t("creating")
                    : t("createSchedule")
              }
              className="btn btn-primary min-h-11 gap-2"
              disabled={isPending}
              type="submit"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {isEditing
                ? isPending
                  ? t("saving")
                  : t("saveChanges")
                : isPending
                  ? t("creating")
                  : t("createSchedule")}
            </button>
          </DialogFooter>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          aria-label={t("closeScheduleDialog")}
          type="button"
          onClick={onClose}
        >
          {t("close")}
        </button>
      </form>
    </dialog>
  );
}
