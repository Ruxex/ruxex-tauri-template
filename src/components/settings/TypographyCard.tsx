import { useTranslation } from "react-i18next";
import { Bars3BottomLeftIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import {
  clampUiFontSize,
  clampUiZoom,
  DEFAULT_FONT_FAMILY,
  SYSTEM_FONT_FALLBACKS,
  type UiFontFamily,
  type UiFontSize,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
} from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function TypographyCard({
  chatFontSize,
  chatFontFamily,
  uiFontSize,
  uiFontFamily,
  uiZoom,
  onChatFontSizeChange,
  onChatFontFamilyChange,
  onReset,
  onUiFontFamilyChange,
  onUiFontSizeChange,
  onUiZoomChange,
}: {
  chatFontSize: UiFontSize;
  chatFontFamily: UiFontFamily;
  uiFontSize: UiFontSize;
  uiFontFamily: UiFontFamily;
  uiZoom: number;
  onChatFontSizeChange: (fontSize: UiFontSize) => void;
  onChatFontFamilyChange: (fontFamily: UiFontFamily) => void;
  onReset: () => void;
  onUiFontFamilyChange: (fontFamily: UiFontFamily) => void;
  onUiFontSizeChange: (fontSize: UiFontSize) => void;
  onUiZoomChange: (zoom: number) => void;
}) {
  const { t } = useTranslation("settings");
  const [fontFamilies, setFontFamilies] = useState<string[]>([
    ...SYSTEM_FONT_FALLBACKS,
  ]);

  useEffect(() => {
    const queryLocalFonts = (
      window as Window & {
        queryLocalFonts?: () => Promise<Array<{ family: string }>>;
      }
    ).queryLocalFonts;
    if (!queryLocalFonts) return;

    let cancelled = false;
    void queryLocalFonts()
      .then((fonts) => {
        if (cancelled) return;
        const families = Array.from(
          new Set([
            DEFAULT_FONT_FAMILY,
            ...fonts.map((font) => font.family.trim()).filter(Boolean),
            ...SYSTEM_FONT_FALLBACKS,
          ]),
        ).sort((left, right) => left.localeCompare(right));
        setFontFamilies(families);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsPanel
      action={
        <button
          aria-label={t("settings:resetToDefault")}
          className="btn btn-ghost btn-sm"
          onClick={onReset}
          type="button"
        >
          {t("settings:resetToDefault")}
        </button>
      }
      icon={Bars3BottomLeftIcon}
      title={t("settings:typography")}
    >
      <div className="divide-y divide-base-300 text-sm">
        <FormFieldRow
          controlId="settings-chat-font-size"
          label={t("settings:chatFontSize")}
        >
          <input
            aria-label={t("settings:chatFontSize")}
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-chat-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onChatFontSizeChange(clampUiFontSize(chatFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onChatFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={chatFontSize}
          />
        </FormFieldRow>
        <FormFieldRow
          controlId="settings-chat-font-family"
          label={t("settings:chatFont")}
        >
          <select
            aria-label={t("settings:chatFont")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-chat-font-family"
            value={chatFontFamily}
            onChange={(event) => onChatFontFamilyChange(event.target.value)}
          >
            {fontFamilies.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>
                {fontFamily === DEFAULT_FONT_FAMILY
                  ? t("settings:systemDefault")
                  : fontFamily}
              </option>
            ))}
          </select>
        </FormFieldRow>
        <FormFieldRow
          controlId="settings-ui-font-size"
          label={t("settings:uiFontSize")}
        >
          <input
            aria-label={t("settings:uiFontSize")}
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-ui-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onUiFontSizeChange(clampUiFontSize(uiFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onUiFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={uiFontSize}
          />
        </FormFieldRow>
        <FormFieldRow
          controlId="settings-ui-font-family"
          label={t("settings:uiFont")}
        >
          <select
            aria-label={t("settings:uiFont")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-ui-font-family"
            value={uiFontFamily}
            onChange={(event) => onUiFontFamilyChange(event.target.value)}
          >
            {fontFamilies.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>
                {fontFamily === DEFAULT_FONT_FAMILY
                  ? t("settings:systemDefault")
                  : fontFamily}
              </option>
            ))}
          </select>
        </FormFieldRow>
        <FormFieldRow
          controlId="settings-ui-zoom"
          label={t("settings:zoomLevel")}
        >
          <select
            aria-label={t("settings:zoomLevel")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-ui-zoom"
            value={uiZoom}
            onChange={(event) =>
              onUiZoomChange(clampUiZoom(Number(event.target.value)))
            }
          >
            {Array.from(
              { length: (UI_ZOOM_MAX - UI_ZOOM_MIN) / 5 + 1 },
              (_, index) => UI_ZOOM_MIN + index * 5,
            ).map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
