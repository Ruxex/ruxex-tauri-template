import { PaintBrushIcon } from "@heroicons/react/24/outline";

import type { UiColorScheme, UiThemePresetId } from "../../app/ui-preferences";
import { UI_THEME_PRESETS } from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

type UiPreferencesCardProps = {
  colorScheme: UiColorScheme;
  preset: UiThemePresetId;
  onColorSchemeChange: (colorScheme: UiColorScheme) => void;
  onThemePresetChange: (preset: UiThemePresetId) => void;
};

export function UiPreferencesCard({
  colorScheme,
  preset,
  onColorSchemeChange,
  onThemePresetChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel icon={PaintBrushIcon} title="Interface">
      <div className="divide-y divide-base-300 text-sm">
        <FormFieldRow controlId="settings-color-scheme" label="Color mode">
          <select
            aria-label="Color mode"
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-color-scheme"
            value={colorScheme}
            onChange={(event) =>
              onColorSchemeChange(event.target.value as UiColorScheme)
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </FormFieldRow>
        <FormFieldRow controlId="settings-theme-preset" label="Theme preset">
          <select
            aria-label="Theme preset"
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-theme-preset"
            value={preset}
            onChange={(event) =>
              onThemePresetChange(event.target.value as UiThemePresetId)
            }
          >
            {UI_THEME_PRESETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
