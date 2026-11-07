import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../../app/error-message";
import {
  DialogFooter,
  DialogHeader,
} from "../../components/common/DialogParts";
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
  return (
    <dialog
      aria-labelledby="schedule-action-dialog-title"
      className="modal"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-md px-5 py-6">
        <DialogHeader
          icon={ExclamationTriangleIcon}
          title={
            action.kind === "run" ? "Run schedule now?" : "Delete schedule?"
          }
          titleId="schedule-action-dialog-title"
        />
        <p className="-mt-2 text-sm text-base-content/70">
          {action.kind === "run"
            ? `Run “${action.schedule.name}” immediately?`
            : `Delete “${action.schedule.name}”? This cannot be undone.`}
        </p>
        {error != null && (
          <p className="mt-4 text-sm text-error" role="alert">
            {formatErrorMessage(error)}
          </p>
        )}
        <DialogFooter>
          <button
            aria-label="Cancel"
            className="btn btn-ghost"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            aria-label={action.kind === "run" ? "Run now" : "Delete"}
            className={`btn ${action.kind === "delete" ? "btn-error" : "btn-primary"}`}
            disabled={isPending}
            type="button"
            onClick={onConfirm}
          >
            {action.kind === "run" ? "Run now" : "Delete"}
          </button>
        </DialogFooter>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" type="button" onClick={onClose}>
          Close
        </button>
      </form>
    </dialog>
  );
}
