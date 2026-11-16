import { useTranslation } from "react-i18next";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../../app/error-message";
import {
  DialogFooter,
  DialogHeader,
} from "../../components/common/DialogParts";
import { useNativeModalDialog } from "../../components/common/useNativeModalDialog";
import type { ScheduleRecord } from "../../platform/schedules";

export type ScheduleAction = {
  kind: "run" | "delete";
  schedule: ScheduleRecord;
};

export function ScheduleActionDialog({
  action,
  error,
  isPending,
  onClose,
  onConfirm,
}: {
  action: ScheduleAction;
  error: unknown;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("schedules");
  const dialogRef = useNativeModalDialog();
  return (
    <dialog
      aria-labelledby="schedule-action-dialog-title"
      className="modal"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-md px-5 py-6">
        <DialogHeader
          icon={ExclamationTriangleIcon}
          title={
            action.kind === "run" ? t("runScheduleNow") : t("deleteSchedule")
          }
          titleId="schedule-action-dialog-title"
        />
        <p className="-mt-2 text-sm text-base-content/70">
          {action.kind === "run"
            ? t("runConfirmation", { name: action.schedule.name })
            : t("deleteConfirmation", { name: action.schedule.name })}
        </p>
        {error != null && (
          <p className="mt-4 text-sm text-error" role="alert">
            {formatErrorMessage(error)}
          </p>
        )}
        <DialogFooter>
          <button
            aria-label={t("cancel")}
            className="btn btn-ghost"
            type="button"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            aria-label={action.kind === "run" ? t("runNow") : t("delete")}
            className={`btn ${action.kind === "delete" ? "btn-error" : "btn-primary"}`}
            disabled={isPending}
            type="button"
            onClick={onConfirm}
          >
            {action.kind === "run" ? t("runNow") : t("delete")}
          </button>
        </DialogFooter>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label={t("close")} type="button" onClick={onClose}>
          {t("close")}
        </button>
      </form>
    </dialog>
  );
}
