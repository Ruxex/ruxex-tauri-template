import { SwatchIcon } from "@heroicons/react/24/outline";

import {
  UI_THEME_COLOR_KEYS,
  type UiThemeColorKey,
  type UiThemeColors,
} from "../../app/ui-preferences";
import { SettingsPanel } from "./SettingsPanel";

const THEME_COLOR_LABELS: Record<UiThemeColorKey, string> = {
  "base-100": "Base 100",
  "base-200": "Base 200",
  "base-300": "Base 300",
  "base-content": "Base content",
  primary: "Primary",
  "primary-content": "Primary content",
  secondary: "Secondary",
  "secondary-content": "Secondary content",
  accent: "Accent",
  "accent-content": "Accent content",
  neutral: "Neutral",
  "neutral-content": "Neutral content",
  info: "Info",
  "info-content": "Info content",
  success: "Success",
  "success-content": "Success content",
  warning: "Warning",
  "warning-content": "Warning content",
  error: "Error",
  "error-content": "Error content",
};

export function ThemeColorsCard({
  colors,
  onColorChange,
}: {
  colors: UiThemeColors;
  onColorChange: (key: UiThemeColorKey, value: string) => void;
}) {
  return (
    <SettingsPanel icon={SwatchIcon} title="Theme colors">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {UI_THEME_COLOR_KEYS.map((key) => {
          const label = THEME_COLOR_LABELS[key];
          const inputId = `settings-theme-color-${key}`;
          return (
            <label className="grid gap-1" htmlFor={inputId} key={key}>
              <span className="text-sm font-medium">{label}</span>
              <span className="font-mono text-xs text-base-content/60">
                --color-{key}
              </span>
              <input
                aria-label={`${label} color`}
                className="input input-bordered input-sm w-full"
                id={inputId}
                onChange={(event) => onColorChange(key, event.target.value)}
                placeholder="DaisyUI default"
                type="text"
                value={colors[key] ?? ""}
              />
            </label>
          );
        })}
      </div>
    </SettingsPanel>
  );
}
