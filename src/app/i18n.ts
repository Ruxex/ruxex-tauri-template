import { createInstance, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import type { UiLanguage } from "./ui-preferences";

// Eager imports keep every namespace available before the router renders.
// New UI-area catalogs are picked up without a second namespace registry.
const catalogs = import.meta.glob("../locales/{en,ja}/*.json", {
  eager: true,
  import: "default",
});
const resources: Resource = { en: {}, ja: {} };
for (const [path, messages] of Object.entries(catalogs)) {
  const [, language, namespace] =
    path.match(/\/locales\/(en|ja)\/([^/]+)\.json$/) ?? [];
  if (language && namespace) {
    resources[language][namespace] = messages as Resource[string][string];
  }
}

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "ja"],
  ns: Object.keys(resources.en),
  defaultNS: "common",
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function resolveUiLanguage(
  language: UiLanguage,
  systemLanguage = typeof navigator !== "undefined" ? navigator.language : "",
): "en" | "ja" {
  if (language !== "system") return language;
  return systemLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function uiLocale(language: UiLanguage): "en" | "ja" {
  return resolveUiLanguage(language);
}

// Retain the existing call-site contract until the settings migration.
export type UiTranslationKey = "quickPanelWaylandUnavailable";

const legacyKeys: Record<UiTranslationKey, string> = {
  quickPanelWaylandUnavailable: "waylandUnavailable",
};

export function translateUi(
  key: UiTranslationKey,
  language: UiLanguage,
): string {
  return i18n.t(legacyKeys[key], {
    ns: "quickPanel",
    lng: resolveUiLanguage(language),
  });
}
