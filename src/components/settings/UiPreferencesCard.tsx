import {
  CheckIcon,
  InformationCircleIcon,
  PaintBrushIcon,
} from "@heroicons/react/24/outline";

import type { UiThemePreset, UiThemePresetId } from "../../app/ui-preferences";
import {
  getUiThemePresetMode,
  getUiThemePresetPreview,
  UI_THEME_PRESETS,
} from "../../app/ui-preferences";
import { SettingsPanel } from "./SettingsPanel";

type UiPreferencesCardProps = {
  preset: UiThemePresetId;
  onThemePresetChange: (preset: UiThemePresetId) => void;
};

export function UiPreferencesCard({
  preset,
  onThemePresetChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel icon={PaintBrushIcon} title="Interface">
      <div className="text-sm">
        <div className="px-5 py-3.5">
          <fieldset
            aria-label="Theme preset options"
            aria-describedby="theme-preset-attribution"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <legend className="label-text mb-3 block">Theme preset</legend>
            <p
              className="col-span-full -mt-1 mb-1 flex items-start gap-1.5 rounded-md border border-base-300 bg-base-200/50 px-2 py-1.5 text-xs leading-relaxed text-base-content/70"
              id="theme-preset-attribution"
            >
              <InformationCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-base-content/55"
              />
              Theme palettes are inspired by third-party projects. Ruxex is not
              affiliated with or endorsed by those projects.
            </p>
            {UI_THEME_PRESETS.map((option) => {
              const selected = preset === option.id;

              return (
                <button
                  aria-label={option.label}
                  aria-pressed={selected}
                  className={`flex min-h-36 flex-col justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-base-300 bg-base-100 hover:border-primary/60"}`}
                  key={option.id}
                  title={option.label}
                  type="button"
                  onClick={() => onThemePresetChange(option.id)}
                >
                  <ThemePresetPreview preset={option} />
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate font-medium leading-tight">
                      {option.label}
                    </span>
                    {selected && (
                      <span
                        aria-hidden="true"
                        data-theme-selected
                        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content"
                      >
                        <CheckIcon className="size-3" />
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-base-content/55">
                    {getThemePresetModeLabel(option.id)}
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

function ThemePresetPreview({ preset }: { preset: UiThemePreset }) {
  if (getUiThemePresetMode(preset.id) === "system") {
    return (
      <span
        aria-hidden="true"
        className="grid grid-cols-2 overflow-hidden rounded-md border border-black/10 shadow-sm"
        data-theme-preview-panel
      >
        <ThemePreviewPanel mode="light" preset={preset} />
        <ThemePreviewPanel mode="dark" preset={preset} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="block overflow-hidden rounded-md border border-black/10 shadow-sm"
      data-theme-preview-panel
    >
      <ThemePreviewPanel
        mode={getUiThemePresetMode(preset.id) === "dark" ? "dark" : "light"}
        preset={preset}
      />
    </span>
  );
}

function getThemePresetModeLabel(preset: UiThemePresetId): string {
  const mode = getUiThemePresetMode(preset);
  return mode === "system" ? "Follows OS" : `${mode} palette`;
}

function ThemePreviewPanel({
  mode,
  preset,
}: {
  mode: "light" | "dark";
  preset: UiThemePreset;
}) {
  const colors = getUiThemePresetPreview(preset, mode);

  return (
    <span
      aria-hidden="true"
      className="block p-2"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <span
        className="mb-1.5 flex items-center justify-between rounded-sm px-1.5 py-1"
        style={{ backgroundColor: colors.surface }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: colors.accent }}
          />
          <span
            className="h-1.5 w-10 rounded-full opacity-70"
            style={{ backgroundColor: colors.muted }}
          />
        </span>
        <span
          className="h-1.5 w-5 rounded-full"
          style={{ backgroundColor: colors.secondary }}
        />
      </span>
      <span
        className="block rounded-sm p-2"
        style={{ backgroundColor: colors.card }}
      >
        <span
          className="mb-1 block h-1.5 w-3/4 rounded-full opacity-80"
          style={{ backgroundColor: colors.text }}
        />
        <span
          className="block h-1.5 w-1/2 rounded-full opacity-45"
          style={{ backgroundColor: colors.muted }}
        />
        <span className="mt-2 flex items-center justify-between gap-1">
          <span
            className="h-1.5 w-8 rounded-full"
            style={{ backgroundColor: colors.muted }}
          />
          <span
            className="rounded-sm px-1.5 py-0.5 text-[8px] font-semibold leading-none"
            style={{
              backgroundColor: colors.primary,
              color: colors.primaryContent,
            }}
          >
            Go
          </span>
        </span>
      </span>
    </span>
  );
}
