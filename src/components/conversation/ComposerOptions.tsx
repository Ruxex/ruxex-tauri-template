import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  PaperClipIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type { SyntheticEvent } from "react";

import {
  availableSubmissionModes,
  type PermissionMode,
  type SubmissionMode,
} from "./composer-model";
import { useCloseDropdownOnOutsidePointerDown } from "./useCloseDropdown";

function closeDropdown(event: SyntheticEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export type { PermissionMode } from "./composer-model";

type ComposerOptionsProps = {
  disabled: boolean;
  goalMode: boolean;
  onAttach: () => void;
  onGoalModeChange: () => void;
  onPlanModeChange: () => void;
  planModeDisabled?: boolean;
  planMode: boolean;
};

export function ComposerOptions({
  disabled,
  goalMode,
  onAttach,
  onGoalModeChange,
  onPlanModeChange,
  planModeDisabled = false,
  planMode,
}: ComposerOptionsProps) {
  const detailsRef = useCloseDropdownOnOutsidePointerDown();

  return (
    <details className="dropdown dropdown-top" ref={detailsRef}>
      <summary
        aria-label="Composer options"
        className="btn btn-ghost btn-sm btn-circle"
      >
        <PlusIcon aria-hidden="true" className="size-5" />
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        <li>
          <button
            aria-label="Attach file"
            disabled={disabled}
            onClick={(event) => {
              onAttach();
              closeDropdown(event);
            }}
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
            aria-label="Goal mode"
            className={goalMode ? "active" : undefined}
            disabled={disabled}
            onClick={(event) => {
              onGoalModeChange();
              closeDropdown(event);
            }}
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
            aria-label="Plan mode"
            className={planMode ? "active" : undefined}
            disabled={disabled || planModeDisabled}
            onClick={(event) => {
              onPlanModeChange();
              closeDropdown(event);
            }}
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
  const detailsRef = useCloseDropdownOnOutsidePointerDown();
  const isFullAccess = mode === "full-access";
  const PermissionIcon = isFullAccess
    ? ExclamationTriangleIcon
    : ShieldCheckIcon;

  return (
    <details className="dropdown dropdown-top" ref={detailsRef}>
      <summary
        aria-label="Permission mode"
        className="btn btn-ghost btn-sm gap-1"
      >
        <PermissionIcon
          aria-hidden="true"
          className={`size-4 ${isFullAccess ? "text-warning" : ""}`}
        />
        <span>{permissionModeLabel(mode)}</span>
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        {permissionOptions.map((option) => (
          <li key={option.mode}>
            <button
              aria-current={mode === option.mode ? "true" : undefined}
              aria-label={option.label}
              disabled={disabled}
              onClick={(event) => {
                onModeChange(option.mode);
                closeDropdown(event);
              }}
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
  const detailsRef = useCloseDropdownOnOutsidePointerDown();

  return (
    <details className="dropdown dropdown-top dropdown-end" ref={detailsRef}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: summary is the native details trigger. */}
      <summary
        aria-disabled={disabled || undefined}
        className={`btn btn-primary btn-sm join-item px-2 ${disabled ? "opacity-50" : ""}`}
        aria-label="Submission mode menu"
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        <span aria-hidden="true">▾</span>
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        {options.map((option) => (
          <li key={option}>
            <button
              aria-label={
                option === "send"
                  ? "Send"
                  : option === "steer"
                    ? "Steer active turn"
                    : "Queue next message"
              }
              type="button"
              role="menuitem"
              disabled={disabled || !modes.includes(option)}
              aria-current={mode === option ? "true" : undefined}
              onClick={(event) => {
                onModeChange(option);
                closeDropdown(event);
              }}
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
