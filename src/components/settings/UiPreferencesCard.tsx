import { PaintBrushIcon } from "@heroicons/react/24/outline";

import type {
  UiAccentColor,
  UiColorScheme,
  UiTheme,
} from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

type UiPreferencesCardProps = {
  colorScheme: UiColorScheme;
  theme: UiTheme;
  onColorSchemeChange: (colorScheme: UiColorScheme) => void;
  onAccentColorChange: (accentColor: UiAccentColor) => void;
};

export function UiPreferencesCard({
  colorScheme,
  theme,
  onColorSchemeChange,
  onAccentColorChange,
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
        <FormFieldRow controlId="settings-theme" label="Theme">
          <select
            aria-label="Theme"
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-theme"
            value={theme.accentColor}
            onChange={(event) =>
              onAccentColorChange(event.target.value as UiAccentColor)
            }
          >
            <option value="blue">Blue</option>
            <option value="violet">Violet</option>
            <option value="emerald">Emerald</option>
            <option value="amber">Amber</option>
            <option value="rose">Rose</option>
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
