import {
  ClipboardDocumentListIcon,
  FlagIcon,
  PaperClipIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import {
  availableSubmissionModes,
  type SubmissionMode,
} from "./composer-model";

export type PermissionMode = "ask" | "read-only" | "full-access";

type ComposerOptionsProps = {
  disabled: boolean;
  goalMode: boolean;
  onAttach: () => void;
  onGoalModeChange: () => void;
  onPlanModeChange: () => void;
  planMode: boolean;
};

export function ComposerOptions({
  disabled,
  goalMode,
  onAttach,
  onGoalModeChange,
  onPlanModeChange,
  planMode,
}: ComposerOptionsProps) {
  return (
    <details className="dropdown dropdown-top">
      <summary
        aria-label="Composer options"
        className="btn btn-ghost btn-sm btn-circle"
      >
        <PlusIcon aria-hidden="true" className="size-5" />
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        <li>
          <button
            disabled={disabled}
            onClick={onAttach}
            role="menuitem"
            type="button"
          >
            <PaperClipIcon aria-hidden="true" className="size-4" />
            Attach file
          </button>
        </li>
        <li>
          <button
            aria-current={goalMode ? "true" : undefined}
            className={goalMode ? "active" : undefined}
            disabled={disabled}
            onClick={onGoalModeChange}
            role="menuitem"
            type="button"
          >
            <FlagIcon aria-hidden="true" className="size-4" />
            Goal mode
          </button>
        </li>
        <li>
          <button
            aria-current={planMode ? "true" : undefined}
            className={planMode ? "active" : undefined}
            disabled={disabled}
            onClick={onPlanModeChange}
            role="menuitem"
            type="button"
          >
            <ClipboardDocumentListIcon aria-hidden="true" className="size-4" />
            Plan mode
          </button>
        </li>
      </ul>
    </details>
  );
}

type PermissionMenuProps = {
  disabled: boolean;
  mode: PermissionMode;
  onModeChange: (mode: PermissionMode) => void;
};

const permissionOptions: Array<{ label: string; mode: PermissionMode }> = [
  { label: "Ask for approval", mode: "ask" },
  { label: "Read-only", mode: "read-only" },
  { label: "Full access", mode: "full-access" },
];

function permissionModeLabel(mode: PermissionMode): string {
  return (
    permissionOptions.find((option) => option.mode === mode)?.label ??
    "Ask for approval"
  );
}

export function PermissionMenu({
  disabled,
  mode,
  onModeChange,
}: PermissionMenuProps) {
  return (
    <details className="dropdown dropdown-top">
      <summary
        aria-label="Permission mode"
        className="btn btn-ghost btn-sm gap-1"
      >
        <ShieldCheckIcon aria-hidden="true" className="size-4" />
        <span>{permissionModeLabel(mode)}</span>
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        {permissionOptions.map((option) => (
          <li key={option.mode}>
            <button
              aria-current={mode === option.mode ? "true" : undefined}
              disabled={disabled}
              onClick={() => onModeChange(option.mode)}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
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
    <details className="dropdown dropdown-top dropdown-end">
      <summary
        className="btn btn-primary btn-sm join-item px-2"
        aria-label="Submission mode menu"
      >
        <span aria-hidden="true">▾</span>
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
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
