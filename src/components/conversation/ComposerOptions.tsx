import { i18n } from "../../app/i18n";
import { useTranslation } from "react-i18next";
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  PaperClipIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";

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
  const { t } = useTranslation("conversation");

  const detailsRef = useCloseDropdownOnOutsidePointerDown();

  return (
    <details className="dropdown dropdown-top" ref={detailsRef}>
      <summary
        aria-label={t("composerOptions")}
        className="btn btn-ghost btn-sm btn-circle"
      >
        <PlusIcon aria-hidden="true" className="size-5" />
      </summary>
      <ul className="menu dropdown-content z-20 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        <li>
          <button
            aria-label={t("attachFile")}
            disabled={disabled}
            onClick={(event) => {
              onAttach();
              closeDropdown(event);
            }}
            role="menuitem"
            type="button"
          >
            <PaperClipIcon aria-hidden="true" className="size-4" />
            {t("attachFile")}
          </button>
        </li>
        <li>
          <button
            aria-current={goalMode ? "true" : undefined}
            aria-label={t("goalMode")}
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
            {t("goalMode")}
          </button>
        </li>
        <li>
          <button
            aria-current={planMode ? "true" : undefined}
            aria-label={t("planMode")}
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
            {t("planMode")}
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

function getPermissionOptions(): Array<{
  description: string;
  label: string;
  mode: PermissionMode;
}> {
  return [
    {
      description: i18n.t("conversation:askBeforeActionsThatNeedApproval"),
      label: i18n.t("conversation:askForApproval"),
      mode: "ask",
    },
    {
      description: i18n.t(
        "conversation:canInspectFilesButCannotChangeThemOrAccessTheNetwork",
      ),
      label: i18n.t("conversation:readonly"),
      mode: "read-only",
    },
    {
      description: i18n.t(
        "conversation:canChangeFilesAndUseToolsWithoutApproval",
      ),
      label: i18n.t("conversation:fullAccess"),
      mode: "full-access",
    },
  ];
}

function permissionModeLabel(mode: PermissionMode): string {
  return (
    getPermissionOptions().find((option) => option.mode === mode)?.label ??
    i18n.t("conversation:askForApproval")
  );
}

export function PermissionMenu({
  disabled,
  mode,
  onModeChange,
}: PermissionMenuProps) {
  const { t } = useTranslation("conversation");

  const detailsRef = useCloseDropdownOnOutsidePointerDown();
  const menuRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isFullAccess = mode === "full-access";
  const PermissionIcon = isFullAccess
    ? ExclamationTriangleIcon
    : ShieldCheckIcon;

  useLayoutEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      const composer = detailsRef.current?.closest("form");
      const menu = menuRef.current;
      if (!composer || !menu) return;

      const composerBounds = composer.getBoundingClientRect();
      const menuHeight = menu.getBoundingClientRect().height;
      menu.style.left = `${composerBounds.left}px`;
      menu.style.top = `${Math.max(8, composerBounds.top - menuHeight - 8)}px`;
      menu.style.width = `${composerBounds.width}px`;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [detailsRef, isOpen]);

  return (
    <details
      className="dropdown dropdown-top"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      ref={detailsRef}
    >
      <summary
        aria-label={t("permissionMode")}
        className="btn btn-ghost btn-sm gap-1"
      >
        <PermissionIcon
          aria-hidden="true"
          className={`size-4 ${isFullAccess ? "text-warning" : ""}`}
        />
        <span>{permissionModeLabel(mode)}</span>
      </summary>
      <ul
        className="menu dropdown-content fixed z-20 mb-2 w-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ref={menuRef}
        style={{ bottom: "auto" }}
      >
        {getPermissionOptions().map((option) => (
          <li key={option.mode}>
            <button
              aria-current={mode === option.mode ? "true" : undefined}
              aria-description={option.description}
              aria-label={option.label}
              className={
                mode === option.mode
                  ? "active bg-primary/20 font-semibold text-base-content"
                  : undefined
              }
              disabled={disabled}
              onClick={(event) => {
                onModeChange(option.mode);
                closeDropdown(event);
              }}
              role="menuitem"
              type="button"
            >
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                <span className="text-xs font-normal text-base-content/60">
                  {option.description}
                </span>
              </span>
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
  const { t } = useTranslation("conversation");

  const modes = availableSubmissionModes(activeTurnId);
  const options: SubmissionMode[] = ["send", "steer", "queue"];
  const detailsRef = useCloseDropdownOnOutsidePointerDown();

  return (
    <details className="dropdown dropdown-top dropdown-end" ref={detailsRef}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: summary is the native details trigger. */}
      <summary
        aria-disabled={disabled || undefined}
        className={`btn btn-primary btn-sm join-item px-2 ${disabled ? "opacity-50" : ""}`}
        aria-label={t("submissionModeMenu")}
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
                  ? t("send")
                  : option === "steer"
                    ? t("steerActiveTurn")
                    : t("queueNextMessage")
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
              <span className="flex flex-col items-start">
                <span>
                  {option === "send"
                    ? t("send")
                    : option === "steer"
                      ? t("steerActiveTurn")
                      : t("queueNextMessage")}
                </span>
                <span className="text-xs font-normal text-base-content/60">
                  {option === "send"
                    ? t("startANewTurnWithThisMessage")
                    : option === "steer"
                      ? t("addThisMessageToTheCurrentResponse")
                      : t("sendItAfterTheCurrentTurnFinishes")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
