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
        <div className="px-5 py-3.5">
          <fieldset
            aria-label="Theme preset options"
            aria-describedby="theme-preset-attribution"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <legend className="label-text mb-3 block">Theme preset</legend>
            <p
              className="col-span-full -mt-1 mb-1 text-xs leading-relaxed text-base-content/60"
              id="theme-preset-attribution"
            >
              Theme palettes are inspired by third-party projects. Ruxex is not
              affiliated with or endorsed by those projects.
            </p>
            {UI_THEME_PRESETS.map((option) => {
              const selected = preset === option.id;
              const previewColors = [
                {
                  color: option.colors["base-100"] ?? "var(--color-base-100)",
                  key: "base",
                },
                {
                  color: option.colors.primary ?? "var(--color-primary)",
                  key: "primary",
                },
                {
                  color: option.colors.secondary ?? "var(--color-secondary)",
                  key: "secondary",
                },
                {
                  color: option.colors.accent ?? "var(--color-accent)",
                  key: "accent",
                },
              ];

              return (
                <button
                  aria-label={option.label}
                  aria-pressed={selected}
                  className={`flex min-h-20 flex-col justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-base-300 bg-base-100 hover:border-primary/60"}`}
                  key={option.id}
                  title={option.label}
                  type="button"
                  onClick={() => onThemePresetChange(option.id)}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-6 grid-cols-4 overflow-hidden rounded-md border border-black/10"
                  >
                    {previewColors.map((swatch) => (
                      <span
                        aria-hidden="true"
                        data-theme-preview-swatch
                        key={`${option.id}-${swatch.key}`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    ))}
                  </span>
                  <span className="font-medium leading-tight">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>
    </SettingsPanel>
  );
}
