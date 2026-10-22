import {
  AdjustmentsHorizontalIcon,
  ClipboardDocumentListIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";

import {
  availableSubmissionModes,
  submissionModeLabel,
  type SubmissionMode,
} from "./composer-model";

type ComposerOptionsProps = {
  activeTurnId: string | null;
  disabled: boolean;
  mode: SubmissionMode;
  planMode: boolean;
  onModeChange: (mode: SubmissionMode) => void;
  onPlanModeChange: () => void;
  onAttach: () => void;
};

export function ComposerOptions({
  activeTurnId,
  disabled,
  mode,
  planMode,
  onModeChange,
  onPlanModeChange,
  onAttach,
}: ComposerOptionsProps) {
  const modes = availableSubmissionModes(activeTurnId);
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex items-center gap-1">
        <AdjustmentsHorizontalIcon
          aria-hidden="true"
          className="size-4 text-base-content/60"
        />
        <select
          className="select select-bordered select-sm"
          value={modes.includes(mode) ? mode : "send"}
          onChange={(event) =>
            onModeChange(event.target.value as SubmissionMode)
          }
          disabled={disabled}
          aria-label="Submission mode"
        >
          <option value="send">{submissionModeLabel("send")}</option>
          <option value="steer" disabled={!modes.includes("steer")}>
            {submissionModeLabel("steer")}
          </option>
          <option value="queue" disabled={!modes.includes("queue")}>
            {submissionModeLabel("queue")}
          </option>
        </select>
      </div>
      <button
        className={`btn btn-sm ${planMode ? "btn-secondary" : "btn-ghost"}`}
        type="button"
        onClick={onPlanModeChange}
        disabled={disabled}
      >
        <ClipboardDocumentListIcon aria-hidden="true" className="size-4" />
        {planMode ? "Plan mode on" : "Plan mode"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        disabled={disabled}
        onClick={onAttach}
        title="Attach an image"
      >
        <PaperClipIcon aria-hidden="true" className="size-4" />
        Attach image
      </button>
    </div>
  );
}
