import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../../app/error-message";
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
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold" id="schedule-action-dialog-title">
              {action.kind === "run" ? "Run schedule now?" : "Delete schedule?"}
            </h2>
            <p className="mt-2 text-sm text-base-content/70">
              {action.kind === "run"
                ? `Run “${action.schedule.name}” immediately?`
                : `Delete “${action.schedule.name}”? This cannot be undone.`}
            </p>
          </div>
        </div>
        {error != null && (
          <p className="mt-4 text-sm text-error" role="alert">
            {formatErrorMessage(error)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${action.kind === "delete" ? "btn-error" : "btn-primary"}`}
            disabled={isPending}
            type="button"
            onClick={onConfirm}
          >
            {action.kind === "run" ? "Run now" : "Delete"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </form>
    </dialog>
  );
}
