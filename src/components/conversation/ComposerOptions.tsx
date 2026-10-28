import {
  ClipboardDocumentListIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";

import { availableSubmissionModes, type SubmissionMode } from "./composer-model";

type ComposerOptionsProps = {
  disabled: boolean;
  planMode: boolean;
  onPlanModeChange: () => void;
  onAttach: () => void;
};

export function ComposerOptions({
  disabled,
  planMode,
  onPlanModeChange,
  onAttach,
}: ComposerOptionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
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

type SubmissionModeMenuProps = {
  activeTurnId: string | null;
  disabled: boolean;
  mode: SubmissionMode;
  onModeChange: (mode: SubmissionMode) => void;
};

export function SubmissionModeMenu({
  activeTurnId,
  disabled,
  mode,
  onModeChange,
}: SubmissionModeMenuProps) {
  const modes = availableSubmissionModes(activeTurnId);
  const options: SubmissionMode[] = ["send", "steer", "queue"];

  return (
    <details className="dropdown dropdown-end">
      <summary
        className="btn btn-primary btn-sm join-item px-2"
        aria-label="Submission mode menu"
      >
        <span aria-hidden="true">▾</span>
      </summary>
      <ul
        className="menu dropdown-content z-20 mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
      >
        {options.map((option) => (
          <li key={option}>
            <button
              type="button"
              role="menuitem"
              disabled={disabled || !modes.includes(option)}
              aria-current={mode === option ? "true" : undefined}
              onClick={() => onModeChange(option)}
            >
              {option === "send"
                ? "Send"
                : option === "steer"
                  ? "Steer active turn"
                  : "Queue next message"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
