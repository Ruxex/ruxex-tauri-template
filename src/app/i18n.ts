import type { UiLanguage } from "./ui-preferences";

export type UiTranslationKey = "quickPanelWaylandUnavailable";

const UI_TRANSLATIONS: Record<
  Exclude<UiLanguage, "system">,
  Record<UiTranslationKey, string>
> = {
  en: {
    quickPanelWaylandUnavailable:
      "Linux / Wayland global shortcuts are currently unavailable.",
  },
  ja: {
    quickPanelWaylandUnavailable:
      "Linux / Waylandではグローバルショートカットは現在利用できません。",
  },
};

function resolveUiLanguage(language: UiLanguage): Exclude<UiLanguage, "system"> {
  if (language !== "system") {
    return language;
  }
  return typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("ja")
    ? "ja"
    : "en";
}

export function translateUi(
  key: UiTranslationKey,
  language: UiLanguage,
): string {
  return UI_TRANSLATIONS[resolveUiLanguage(language)][key];
}
