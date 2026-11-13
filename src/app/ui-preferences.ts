import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  UI_ACCENT_COLORS,
  UI_THEME_COLOR_KEYS,
  UI_THEME_PRESET_IDS,
  applyUiTheme,
  getUiThemePresetMode,
  type UiTheme,
  type UiThemeColors,
  type UiThemePresetId,
} from "./ui-themes";
export * from "./ui-themes";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 9;

export type UiLanguage = "system" | "en" | "ja";
export const UI_FONT_SIZE_MIN = 10;
export const UI_FONT_SIZE_MAX = 32;
export const DEFAULT_CHAT_FONT_SIZE = 14;
export const DEFAULT_UI_FONT_SIZE = 14;
export const DEFAULT_FONT_FAMILY = "system-ui";
export const UI_ZOOM_MIN = 75;
export const UI_ZOOM_MAX = 125;
export const DEFAULT_UI_ZOOM = 100;
export const SYSTEM_FONT_FALLBACKS = [
  "system-ui",
  "Inter",
  "Segoe UI",
  "San Francisco",
  "Roboto",
  "Noto Sans",
  "Arial",
  "sans-serif",
] as const;
export type UiFontFamily = string;
export type UiFontSize = number;

export function clampUiFontSize(value: number): UiFontSize {
  if (!Number.isFinite(value)) return DEFAULT_UI_FONT_SIZE;
  return Math.min(
    UI_FONT_SIZE_MAX,
    Math.max(UI_FONT_SIZE_MIN, Math.round(value)),
  );
}

export function clampUiZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_UI_ZOOM;
  return Math.min(
    UI_ZOOM_MAX,
    Math.max(UI_ZOOM_MIN, Math.round(value / 5) * 5),
  );
}
export const UI_NOTIFICATION_SOUND_OPTIONS = [
  { value: "system", label: "System default" },
  { value: "Ping", label: "Ping (macOS)" },
  { value: "message-new-instant", label: "Message (Linux)" },
] as const;
export type UiNotificationSound =
  (typeof UI_NOTIFICATION_SOUND_OPTIONS)[number]["value"];
export const UI_NOTIFICATION_SOUNDS: readonly UiNotificationSound[] =
  UI_NOTIFICATION_SOUND_OPTIONS.map((option) => option.value);
export type UiNotifications = {
  desktop: boolean;
  sound: UiNotificationSound;
};
export type UiPreferences = {
  version: typeof UI_PREFERENCES_VERSION;
  sidebarCollapsed: boolean;
  language: UiLanguage;
  notifications: UiNotifications;
  theme: UiTheme;
  chatFontSize: UiFontSize;
  uiFontSize: UiFontSize;
  chatFontFamily: UiFontFamily;
  uiFontFamily: UiFontFamily;
  uiZoom: number;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: UI_PREFERENCES_VERSION,
  sidebarCollapsed: false,
  language: "system",
  notifications: { desktop: true, sound: "system" },
  theme: { accentColor: "blue", preset: "system" },
  chatFontSize: DEFAULT_CHAT_FONT_SIZE,
  uiFontSize: DEFAULT_UI_FONT_SIZE,
  chatFontFamily: DEFAULT_FONT_FAMILY,
  uiFontFamily: DEFAULT_FONT_FAMILY,
  uiZoom: DEFAULT_UI_ZOOM,
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
        parsed.version !== 3 &&
        parsed.version !== 4 &&
        parsed.version !== 5 &&
        parsed.version !== 6 &&
        parsed.version !== 7 &&
        parsed.version !== 8 &&
        parsed.version !== UI_PREFERENCES_VERSION)
    ) {
      return DEFAULT_UI_PREFERENCES;
    }

    const legacyColorScheme =
      typeof parsed.colorScheme === "string"
        ? parsed.colorScheme
        : parsed.version === 1 && typeof parsed.theme === "string"
          ? parsed.theme
          : undefined;
    const storedTheme = isRecord(parsed.theme) ? parsed.theme : undefined;
    const storedPreset = readOptionalEnum(
      storedTheme?.preset,
      UI_THEME_PRESET_IDS,
    );
    const legacyPreset =
      legacyColorScheme === "dark"
        ? "ruxex-dark"
        : legacyColorScheme === "light"
          ? "ruxex-light"
          : legacyColorScheme === "system"
            ? "system"
            : storedTheme?.preset === "daisyui"
              ? "system"
              : undefined;

    return {
      version: UI_PREFERENCES_VERSION,
      sidebarCollapsed: readBoolean(
        parsed.sidebarCollapsed,
        DEFAULT_UI_PREFERENCES.sidebarCollapsed,
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
        sound: readEnum(
          isRecord(parsed.notifications)
            ? parsed.notifications.sound
            : undefined,
          UI_NOTIFICATION_SOUNDS,
          DEFAULT_UI_PREFERENCES.notifications.sound,
        ),
      },
      theme: {
        accentColor: readEnum(
          storedTheme?.accentColor,
          UI_ACCENT_COLORS,
          DEFAULT_UI_PREFERENCES.theme.accentColor,
        ),
        preset:
          storedPreset ?? legacyPreset ?? DEFAULT_UI_PREFERENCES.theme.preset,
        colors: readThemeColors(storedTheme?.colors),
      },
      chatFontSize: readFontSize(
        parsed.chatFontSize,
        DEFAULT_UI_PREFERENCES.chatFontSize,
      ),
      uiFontSize: readFontSize(
        parsed.uiFontSize,
        DEFAULT_UI_PREFERENCES.uiFontSize,
      ),
      chatFontFamily: readFontFamily(
        parsed.chatFontFamily,
        DEFAULT_UI_PREFERENCES.chatFontFamily,
      ),
      uiFontFamily: readFontFamily(
        parsed.uiFontFamily,
        DEFAULT_UI_PREFERENCES.uiFontFamily,
      ),
      uiZoom: clampUiZoom(
        typeof parsed.uiZoom === "number"
          ? parsed.uiZoom
          : DEFAULT_UI_PREFERENCES.uiZoom,
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

function readOptionalEnum<T extends string>(
  value: unknown,
  values: readonly T[],
): T | undefined {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : undefined;
}

function readFontSize(value: unknown, fallback: UiFontSize): UiFontSize {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= UI_FONT_SIZE_MIN &&
    value <= UI_FONT_SIZE_MAX
    ? value
    : fallback;
}

function readFontFamily(value: unknown, fallback: UiFontFamily): UiFontFamily {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readThemeColors(value: unknown): UiThemeColors {
  if (!isRecord(value)) {
    return {};
  }

  const colors: UiThemeColors = {};
  for (const key of UI_THEME_COLOR_KEYS) {
    const color = value[key];
    if (typeof color === "string" && color.trim()) {
      colors[key] = color;
    }
  }
  return colors;
}

function readStoredPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES;
  }
  return parseUiPreferences(window.localStorage.getItem(UI_PREFERENCES_KEY));
}

function resolvedThemeMode(preset: UiThemePresetId): "light" | "dark" {
  const mode = getUiThemePresetMode(preset);
  if (mode !== "system") {
    return mode;
  }

  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useStoredUiPreferences(): UiPreferencesContextValue {
  const [preferences, setPreferences] = useState(readStoredPreferences);

  useEffect(() => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
    document.documentElement.dataset.uiFontSize = String(
      preferences.uiFontSize,
    );
    document.documentElement.style.setProperty(
      "--ruxex-ui-font-size",
      `${preferences.uiFontSize}px`,
    );
    document.documentElement.style.setProperty(
      "--ruxex-chat-font-size",
      `${preferences.chatFontSize}px`,
    );
    document.documentElement.style.setProperty(
      "--ruxex-ui-font-family",
      preferences.uiFontFamily,
    );
    document.documentElement.style.setProperty(
      "--ruxex-chat-font-family",
      preferences.chatFontFamily,
    );
    document.documentElement.style.zoom = `${preferences.uiZoom}%`;
    document.documentElement.lang =
      preferences.language === "system"
        ? navigator.language.startsWith("ja")
          ? "ja"
          : "en"
        : preferences.language;
  }, [preferences]);

  useEffect(() => {
    const preset = preferences.theme.preset ?? "system";
    const applyTheme = () => {
      const mode = resolvedThemeMode(preset);
      document.documentElement.dataset.theme = mode;
      document.documentElement.removeAttribute("data-accent");
      applyUiTheme(preferences.theme, mode);
    };

    applyTheme();
    if (
      getUiThemePresetMode(preset) !== "system" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [preferences.theme]);

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
