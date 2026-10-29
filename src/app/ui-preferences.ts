import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 5;

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
export const UI_FONT_SIZE_MIN = 10;
export const UI_FONT_SIZE_MAX = 32;
export const DEFAULT_CHAT_FONT_SIZE = 12;
export const DEFAULT_UI_FONT_SIZE = 14;
export type UiFontSize = number;

export function clampUiFontSize(value: number): UiFontSize {
  if (!Number.isFinite(value)) return DEFAULT_UI_FONT_SIZE;
  return Math.min(
    UI_FONT_SIZE_MAX,
    Math.max(UI_FONT_SIZE_MIN, Math.round(value)),
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
  colorScheme: UiColorScheme;
  theme: UiTheme;
  chatFontSize: UiFontSize;
  uiFontSize: UiFontSize;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: UI_PREFERENCES_VERSION,
  sidebarCollapsed: false,
  language: "system",
  notifications: { desktop: true, sound: "system" },
  colorScheme: "system",
  theme: { accentColor: "blue" },
  chatFontSize: DEFAULT_CHAT_FONT_SIZE,
  uiFontSize: DEFAULT_UI_FONT_SIZE,
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
      chatFontSize: readFontSize(
        parsed.chatFontSize,
        DEFAULT_UI_PREFERENCES.chatFontSize,
      ),
      uiFontSize: readFontSize(
        parsed.uiFontSize,
        DEFAULT_UI_PREFERENCES.uiFontSize,
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

function readFontSize(value: unknown, fallback: UiFontSize): UiFontSize {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= UI_FONT_SIZE_MIN &&
    value <= UI_FONT_SIZE_MAX
    ? value
    : fallback;
}

function readStoredPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES;
  }
  return parseUiPreferences(window.localStorage.getItem(UI_PREFERENCES_KEY));
}

function resolvedColorScheme(colorScheme: UiColorScheme): "light" | "dark" {
  if (colorScheme !== "system") {
    return colorScheme;
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
    document.documentElement.dataset.theme = resolvedColorScheme(
      preferences.colorScheme,
    );
    document.documentElement.dataset.accent = preferences.theme.accentColor;
    document.documentElement.dataset.chatFontSize = String(
      preferences.chatFontSize,
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
