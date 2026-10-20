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
};

export function ComposerOptions({
  activeTurnId,
  disabled,
  mode,
  planMode,
  onModeChange,
  onPlanModeChange,
}: ComposerOptionsProps) {
  const modes = availableSubmissionModes(activeTurnId);
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="select select-bordered select-sm"
        value={modes.includes(mode) ? mode : "send"}
        onChange={(event) => onModeChange(event.target.value as SubmissionMode)}
        disabled={disabled}
        aria-label="Submission mode"
      >
        <option value="send">{submissionModeLabel("send")}</option>
        <option value="steer" disabled={!modes.includes("steer")}>{submissionModeLabel("steer")}</option>
        <option value="queue" disabled={!modes.includes("queue")}>{submissionModeLabel("queue")}</option>
      </select>
      <button
        className={`btn btn-sm ${planMode ? "btn-secondary" : "btn-ghost"}`}
        type="button"
        onClick={onPlanModeChange}
        disabled={disabled}
      >
        {planMode ? "Plan mode on" : "Plan mode"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        disabled
        title="Attachment upload must be implemented through the App Server attachment API."
      >
        Attach
      </button>
    </div>
  );
}
