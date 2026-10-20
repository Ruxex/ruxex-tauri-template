import { useEffect, useState } from "react";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 1;

export type UiTheme = "system" | "light" | "dark";
export type ContextTab = "activity" | "changes" | "context";
export type UiDensity = "comfortable" | "compact";

export type UiPreferences = {
  version: typeof UI_PREFERENCES_VERSION;
  sidebarCollapsed: boolean;
  contextDrawerOpen: boolean;
  contextTab: ContextTab;
  theme: UiTheme;
  density: UiDensity;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: UI_PREFERENCES_VERSION,
  sidebarCollapsed: false,
  contextDrawerOpen: true,
  contextTab: "activity",
  theme: "system",
  density: "comfortable",
};

export type UiPreferencePatch = Partial<Omit<UiPreferences, "version">>;

export function updateUiPreferences(
  preferences: UiPreferences,
  patch: UiPreferencePatch,
): UiPreferences {
  return {
    ...preferences,
    ...patch,
    version: UI_PREFERENCES_VERSION,
  };
}

export function parseUiPreferences(raw: string | null): UiPreferences {
  if (!raw) {
    return DEFAULT_UI_PREFERENCES;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== UI_PREFERENCES_VERSION) {
      return DEFAULT_UI_PREFERENCES;
    }

    return {
      version: UI_PREFERENCES_VERSION,
      sidebarCollapsed: readBoolean(parsed.sidebarCollapsed, DEFAULT_UI_PREFERENCES.sidebarCollapsed),
      contextDrawerOpen: readBoolean(parsed.contextDrawerOpen, DEFAULT_UI_PREFERENCES.contextDrawerOpen),
      contextTab: readEnum(parsed.contextTab, ["activity", "changes", "context"], DEFAULT_UI_PREFERENCES.contextTab),
      theme: readEnum(parsed.theme, ["system", "light", "dark"], DEFAULT_UI_PREFERENCES.theme),
      density: readEnum(parsed.density, ["comfortable", "compact"], DEFAULT_UI_PREFERENCES.density),
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readEnum<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;
}

function readStoredPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES;
  }
  return parseUiPreferences(window.localStorage.getItem(UI_PREFERENCES_KEY));
}

export function useUiPreferences() {
  const [preferences, setPreferences] = useState(readStoredPreferences);

  useEffect(() => {
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.density = preferences.density;
  }, [preferences]);

  function update(patch: UiPreferencePatch) {
    setPreferences((current) => updateUiPreferences(current, patch));
  }

  return { preferences, update };
}
