import { CommandLineIcon } from "@heroicons/react/24/outline";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function QuickPanelCard({
  defaultShortcut,
  disabled,
  error,
  isLoading,
  waylandNotice,
  onReset,
  onSave,
  onShortcutKeyDown,
  shortcut,
}: {
  defaultShortcut: string;
  disabled: boolean;
  error?: string | null;
  isLoading: boolean;
  waylandNotice: string;
  onReset: () => void;
  onSave: () => void;
  onShortcutKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  shortcut: string;
}) {
  return (
    <SettingsPanel icon={CommandLineIcon} title="Quick panel">
      <div className="text-sm">
        <FormFieldRow
          controlId="settings-quick-panel-shortcut"
          label="Global shortcut"
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm justify-self-end" />
          ) : (
            <div className="flex w-full max-w-sm justify-self-end gap-2 max-sm:max-w-none">
              <input
                aria-label="Quick panel shortcut"
                className="input input-bordered input-sm min-w-0 flex-1"
                disabled={disabled}
                id="settings-quick-panel-shortcut"
                onKeyDown={onShortcutKeyDown}
                placeholder="Press keys…"
                readOnly
                value={shortcut}
              />
            </div>
          )}
        </FormFieldRow>
        <p className="px-5 pb-3 text-xs text-base-content/60">
          {waylandNotice}
        </p>
        {!isLoading && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5">
            <span className="mr-auto text-xs text-base-content/60">
              Default: {defaultShortcut}
            </span>
            <button
              aria-label="Reset"
              className="btn btn-ghost btn-sm"
              disabled={disabled || shortcut === defaultShortcut}
              onClick={onReset}
              type="button"
            >
              Reset
            </button>
            <button
              aria-label={disabled ? "Saving…" : "Save"}
              className="btn btn-primary btn-sm"
              disabled={disabled || !shortcut.trim()}
              onClick={onSave}
              type="button"
            >
              {disabled ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="px-5 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </SettingsPanel>
  );
}
