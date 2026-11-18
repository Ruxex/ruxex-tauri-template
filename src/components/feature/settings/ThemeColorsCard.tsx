import { useTranslation } from "react-i18next";
import { SwatchIcon } from "@heroicons/react/24/outline";

import {
  UI_THEME_PRESETS,
  type UiThemeColorKey,
  type UiThemeColors,
  type UiThemePresetId,
} from "@/app/ui-preferences";

const THEME_COLOR_LABELS: Record<UiThemeColorKey, string> = {
  "base-100": "base100",
  "base-200": "base200",
  "base-300": "base300",
  "base-content": "baseContent",
  primary: "primary",
  "primary-content": "primaryContent",
  secondary: "secondary",
  "secondary-content": "secondaryContent",
  accent: "accent",
  "accent-content": "accentContent",
  neutral: "neutral",
  "neutral-content": "neutralContent",
  info: "info",
  "info-content": "infoContent",
  success: "success",
  "success-content": "successContent",
  warning: "warning",
  "warning-content": "warningContent",
  error: "error",
  "error-content": "errorContent",
};

const THEME_COLOR_GROUPS: readonly {
  label: string;
  keys: readonly UiThemeColorKey[];
}[] = [
  {
    label: "baseColors",
    keys: ["base-100", "base-200", "base-300", "base-content"],
  },
  {
    label: "brandColors",
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
    label: "statusColors",
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
  const { t } = useTranslation("settings");
  const brandName = t("common:brandName");
  const brandedPresetLabels: Record<string, string> = {
    "ruxex-light": t("settings:themePresetRuxexLight", { brandName }),
    "ruxex-dark": t("settings:themePresetRuxexDark", { brandName }),
    "ruxex-ink-mint": t("settings:themePresetRuxexInkMint", { brandName }),
  };
  const presetLabel =
    preset === "system"
      ? t("settings:system")
      : (brandedPresetLabels[preset] ??
        UI_THEME_PRESETS.find((option) => option.id === preset)?.label ??
        t("settings:system"));

  return (
    <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm">
      <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
        <SwatchIcon aria-hidden="true" className="size-5 text-primary" />
        {t("settings:advancedThemeColors")}
      </summary>
      <div className="collapse-content p-0">
        <div className="border-t border-base-300">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-xs text-base-content/60">
              {t("settings:inheritedFrom", { preset: presetLabel })}
            </span>
            <button
              aria-label={t("settings:resetAdvancedColors")}
              className="btn btn-ghost btn-xs"
              type="button"
              onClick={() => onReset?.()}
            >
              {t("settings:resetColors")}
            </button>
          </div>
          <div className="space-y-6 px-5 pb-5">
            {THEME_COLOR_GROUPS.map((group) => (
              <fieldset className="grid gap-3" key={group.label}>
                <legend className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  {t(`settings:${group.label}`)}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.keys.map((key) => {
                    const label = t(`settings:${THEME_COLOR_LABELS[key]}`);
                    const inputId = `settings-theme-color-${key}`;
                    return (
                      <label className="grid gap-1" htmlFor={inputId} key={key}>
                        <span className="text-sm font-medium">{label}</span>
                        <span className="font-mono text-xs text-base-content/60">--color-{key}</span>
                        <input
                          aria-label={t("settings:colorLabel", { label })}
                          className="input input-bordered input-sm w-full"
                          id={inputId}
                          onChange={(event) => onColorChange(key, event.target.value)}
                          placeholder={t("settings:inheritedFrom", {
                            preset: presetLabel,
                          })}
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
