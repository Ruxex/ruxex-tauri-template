import { SwatchIcon } from "@heroicons/react/24/outline";

import {
  UI_THEME_PRESETS,
  type UiThemeColorKey,
  type UiThemeColors,
  type UiThemePresetId,
} from "../../app/ui-preferences";

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

const THEME_COLOR_GROUPS: readonly {
  label: string;
  keys: readonly UiThemeColorKey[];
}[] = [
  {
    label: "Base colors",
    keys: ["base-100", "base-200", "base-300", "base-content"],
  },
  {
    label: "Brand colors",
    keys: [
      "primary",
      "primary-content",
      "secondary",
      "secondary-content",
      "accent",
      "accent-content",
      "neutral",
      "neutral-content",
    ],
  },
  {
    label: "Status colors",
    keys: [
      "info",
      "info-content",
      "success",
      "success-content",
      "warning",
      "warning-content",
      "error",
      "error-content",
    ],
  },
];

export function ThemeColorsCard({
  colors,
  onColorChange,
  onReset,
  preset = "system",
}: {
  colors: UiThemeColors;
  onColorChange: (key: UiThemeColorKey, value: string) => void;
  onReset?: () => void;
  preset?: UiThemePresetId;
}) {
  const presetLabel =
    UI_THEME_PRESETS.find((option) => option.id === preset)?.label ?? "System";

  return (
    <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm">
      <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
        <SwatchIcon aria-hidden="true" className="size-5 text-primary" />
        Advanced theme colors
      </summary>
      <div className="collapse-content p-0">
        <div className="border-t border-base-300">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-xs text-base-content/60">
              Inherited from {presetLabel}
            </span>
            <button
              aria-label="Reset advanced colors"
              className="btn btn-ghost btn-xs"
              type="button"
              onClick={() => onReset?.()}
            >
              Reset colors
            </button>
          </div>
          <div className="space-y-6 px-5 pb-5">
            {THEME_COLOR_GROUPS.map((group) => (
              <fieldset className="grid gap-3" key={group.label}>
                <legend className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  {group.label}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.keys.map((key) => {
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
                          onChange={(event) =>
                            onColorChange(key, event.target.value)
                          }
                          placeholder={`Inherited from ${presetLabel}`}
                          type="text"
                          value={colors[key] ?? ""}
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
