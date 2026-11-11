import {
  CheckIcon,
  ChevronDownIcon,
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
  const selectedPreset =
    UI_THEME_PRESETS.find((option) => option.id === preset) ??
    UI_THEME_PRESETS[0];

  return (
    <SettingsPanel allowOverflow icon={PaintBrushIcon} title="Interface">
      <div className="text-sm">
        <div className="px-5 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <details
              data-testid="theme-preset-selector"
              className="group relative z-50 min-w-0 flex-1"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 p-3 transition-colors hover:border-primary/60 hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <span className="min-w-0">
                  <span className="block text-xs text-base-content/60">
                    Theme preset
                  </span>
                  <span className="block truncate font-medium">
                    {selectedPreset.label}
                  </span>
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="absolute left-0 right-0 top-full z-[60] mt-3 max-h-[min(70vh,32rem)] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
                <fieldset
                  aria-label="Theme preset options"
                  aria-describedby="theme-preset-attribution"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  <legend className="sr-only">Theme preset options</legend>
                  <p
                    className="col-span-full flex items-start gap-1.5 rounded-md border border-base-300 bg-base-200/50 px-2 py-1.5 text-xs leading-relaxed text-base-content/70"
                    id="theme-preset-attribution"
                  >
                    <InformationCircleIcon
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-base-content/55"
                    />
                    Theme palettes are inspired by third-party projects. Ruxex
                    is not affiliated with or endorsed by those projects.
                  </p>
                  {UI_THEME_PRESETS.map((option) => {
                    const selected = preset === option.id;

                    return (
                      <button
                        aria-label={option.label}
                        aria-pressed={selected}
                        className={`flex min-h-32 flex-col justify-between gap-1.5 rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-base-300 bg-base-100 hover:border-primary/60"}`}
                        key={option.id}
                        title={option.label}
                        type="button"
                        onClick={(event) => {
                          onThemePresetChange(option.id);
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                        }}
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
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            </details>
            <div className="w-full shrink-0 sm:w-36" data-current-theme-preview>
              <ThemePresetPreview preset={selectedPreset} />
            </div>
          </div>
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
        data-theme-preview-header
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
        className="block rounded-sm p-1.5"
        style={{ backgroundColor: colors.card }}
      >
        <span className="mb-1.5 flex justify-end" data-theme-preview-message>
          <span
            className="h-2.5 w-2/3 rounded-md rounded-br-sm"
            style={{ backgroundColor: colors.primary }}
          />
        </span>
        <span className="mb-1.5 flex" data-theme-preview-message>
          <span
            className="h-3.5 w-3/4 rounded-md rounded-bl-sm"
            style={{ backgroundColor: colors.surface }}
          />
        </span>
        <span
          className="flex items-center gap-1 rounded-md px-1.5 py-1"
          data-theme-preview-composer
          style={{ backgroundColor: colors.surface }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: colors.muted }}
          />
          <span
            className="h-1.5 flex-1 rounded-full opacity-55"
            style={{ backgroundColor: colors.muted }}
          />
          <span
            className="size-3.5 rounded-sm"
            data-theme-preview-send
            style={{
              backgroundColor: colors.primary,
              color: colors.primaryContent,
            }}
          >
            <span className="sr-only">Send</span>
          </span>
        </span>
      </span>
    </span>
  );
}
