import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 3;

export type UiColorScheme = "system" | "light" | "dark";
export type UiLanguage = "system" | "en" | "ja";
export const UI_ACCENT_COLORS = [
  "blue",
  "violet",
  "emerald",
  "amber",
  "rose",
] as const;
export type UiAccentColor = (typeof UI_ACCENT_COLORS)[number];
export type UiTheme = { accentColor: UiAccentColor };
export type UiNotifications = { desktop: boolean };
export type ContextTab = "activity" | "changes" | "context";
export type UiDensity = "comfortable" | "compact";

export type UiPreferences = {
  version: typeof UI_PREFERENCES_VERSION;
  sidebarCollapsed: boolean;
  contextDrawerOpen: boolean;
  contextTab: ContextTab;
  language: UiLanguage;
  notifications: UiNotifications;
  colorScheme: UiColorScheme;
  theme: UiTheme;
  density: UiDensity;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: UI_PREFERENCES_VERSION,
  sidebarCollapsed: false,
  contextDrawerOpen: true,
  contextTab: "activity",
  language: "system",
  notifications: { desktop: true },
  colorScheme: "system",
  theme: { accentColor: "blue" },
  density: "comfortable",
};

export type UiPreferencePatch = Partial<Omit<UiPreferences, "version">>;

type UiPreferencesContextValue = {
  preferences: UiPreferences;
  update: (patch: UiPreferencePatch) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(
  null,
);

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
    if (
      !isRecord(parsed) ||
      (parsed.version !== 1 &&
        parsed.version !== 2 &&
        parsed.version !== UI_PREFERENCES_VERSION)
    ) {
      return DEFAULT_UI_PREFERENCES;
    }

    const legacyColorScheme = parsed.version === 1 ? parsed.theme : undefined;
    const storedTheme = isRecord(parsed.theme) ? parsed.theme : undefined;

    return {
      version: UI_PREFERENCES_VERSION,
      sidebarCollapsed: readBoolean(
        parsed.sidebarCollapsed,
        DEFAULT_UI_PREFERENCES.sidebarCollapsed,
      ),
      contextDrawerOpen: readBoolean(
        parsed.contextDrawerOpen,
        DEFAULT_UI_PREFERENCES.contextDrawerOpen,
      ),
      contextTab: readEnum(
        parsed.contextTab,
        ["activity", "changes", "context"],
        DEFAULT_UI_PREFERENCES.contextTab,
      ),
      language: readEnum(
        parsed.language,
        ["system", "en", "ja"],
        DEFAULT_UI_PREFERENCES.language,
      ),
      notifications: {
        desktop: readBoolean(
          isRecord(parsed.notifications)
            ? parsed.notifications.desktop
            : undefined,
          DEFAULT_UI_PREFERENCES.notifications.desktop,
        ),
      },
      colorScheme: readEnum(
        parsed.colorScheme ?? legacyColorScheme,
        ["system", "light", "dark"],
        DEFAULT_UI_PREFERENCES.colorScheme,
      ),
      theme: {
        accentColor: readEnum(
          storedTheme?.accentColor,
          UI_ACCENT_COLORS,
          DEFAULT_UI_PREFERENCES.theme.accentColor,
        ),
      },
      density: readEnum(
        parsed.density,
        ["comfortable", "compact"],
        DEFAULT_UI_PREFERENCES.density,
      ),
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

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function readStoredPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES;
  }
  return parseUiPreferences(window.localStorage.getItem(UI_PREFERENCES_KEY));
}

function useStoredUiPreferences(): UiPreferencesContextValue {
  const [preferences, setPreferences] = useState(readStoredPreferences);

  useEffect(() => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
    document.documentElement.dataset.theme = preferences.colorScheme;
    document.documentElement.dataset.accent = preferences.theme.accentColor;
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.lang =
      preferences.language === "system"
        ? navigator.language.startsWith("ja")
          ? "ja"
          : "en"
        : preferences.language;
  }, [preferences]);

  function update(patch: UiPreferencePatch) {
    setPreferences((current) => updateUiPreferences(current, patch));
  }

  return { preferences, update };
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const value = useStoredUiPreferences();
  return createElement(UiPreferencesContext.Provider, { value }, children);
}

export function useUiPreferences(): UiPreferencesContextValue {
  const value = useContext(UiPreferencesContext);
  if (!value) {
    throw new Error(
      "useUiPreferences must be used within UiPreferencesProvider",
    );
  }
  return value;
}
