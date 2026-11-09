import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 7;

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
export const UI_THEME_COLOR_KEYS = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "neutral",
  "neutral-content",
  "info",
  "info-content",
  "success",
  "success-content",
  "warning",
  "warning-content",
  "error",
  "error-content",
] as const;
export type UiThemeColorKey = (typeof UI_THEME_COLOR_KEYS)[number];
export type UiThemeColors = Partial<Record<UiThemeColorKey, string>>;
export const UI_THEME_PRESET_IDS = [
  "daisyui",
  "vscode-dark",
  "github-light",
  "github-dark",
  "dracula",
  "nord",
  "solarized-light",
  "monokai",
] as const;
export type UiThemePresetId = (typeof UI_THEME_PRESET_IDS)[number];
export type UiThemePreset = {
  id: UiThemePresetId;
  label: string;
  colors: UiThemeColors;
};

function createThemeColors({
  base100,
  base200,
  base300,
  baseContent,
  primary,
  secondary,
  accent,
  neutral,
  info,
  success,
  warning,
  error,
  coloredContent = "#ffffff",
}: {
  base100: string;
  base200: string;
  base300: string;
  baseContent: string;
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  coloredContent?: string;
}): UiThemeColors {
  return {
    "base-100": base100,
    "base-200": base200,
    "base-300": base300,
    "base-content": baseContent,
    primary,
    "primary-content": coloredContent,
    secondary,
    "secondary-content": coloredContent,
    accent,
    "accent-content": coloredContent,
    neutral,
    "neutral-content": coloredContent,
    info,
    "info-content": coloredContent,
    success,
    "success-content": coloredContent,
    warning,
    "warning-content": coloredContent,
    error,
    "error-content": coloredContent,
  };
}

export const UI_THEME_PRESETS: readonly UiThemePreset[] = [
  { id: "daisyui", label: "DaisyUI Default", colors: {} },
  {
    id: "vscode-dark",
    label: "VS Code Dark+",
    colors: createThemeColors({
      base100: "#1e1e1e",
      base200: "#252526",
      base300: "#333333",
      baseContent: "#d4d4d4",
      primary: "#007acc",
      secondary: "#569cd6",
      accent: "#c586c0",
      neutral: "#808080",
      info: "#4fc1ff",
      success: "#6a9955",
      warning: "#dcdcaa",
      error: "#f44747",
    }),
  },
  {
    id: "github-light",
    label: "GH Light",
    colors: createThemeColors({
      base100: "#ffffff",
      base200: "#f6f8fa",
      base300: "#d0d7de",
      baseContent: "#1f2328",
      primary: "#0969da",
      secondary: "#8250df",
      accent: "#1a7f37",
      neutral: "#6e7781",
      info: "#0969da",
      success: "#1a7f37",
      warning: "#9a6700",
      error: "#cf222e",
      coloredContent: "#ffffff",
    }),
  },
  {
    id: "github-dark",
    label: "GH Dark",
    colors: createThemeColors({
      base100: "#0d1117",
      base200: "#161b22",
      base300: "#30363d",
      baseContent: "#e6edf3",
      primary: "#2f81f7",
      secondary: "#a371f7",
      accent: "#3fb950",
      neutral: "#8b949e",
      info: "#58a6ff",
      success: "#3fb950",
      warning: "#d29922",
      error: "#f85149",
    }),
  },
  {
    id: "dracula",
    label: "Dracula",
    colors: createThemeColors({
      base100: "#282a36",
      base200: "#44475a",
      base300: "#6272a4",
      baseContent: "#f8f8f2",
      primary: "#bd93f9",
      secondary: "#ff79c6",
      accent: "#50fa7b",
      neutral: "#6272a4",
      info: "#8be9fd",
      success: "#50fa7b",
      warning: "#ffb86c",
      error: "#ff5555",
    }),
  },
  {
    id: "nord",
    label: "Nord",
    colors: createThemeColors({
      base100: "#2e3440",
      base200: "#3b4252",
      base300: "#434c5e",
      baseContent: "#eceff4",
      primary: "#5e81ac",
      secondary: "#b48ead",
      accent: "#88c0d0",
      neutral: "#4c566a",
      info: "#81a1c1",
      success: "#a3be8c",
      warning: "#ebcb8b",
      error: "#bf616a",
      coloredContent: "#2e3440",
    }),
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    colors: createThemeColors({
      base100: "#fdf6e3",
      base200: "#eee8d5",
      base300: "#93a1a1",
      baseContent: "#586e75",
      primary: "#268bd2",
      secondary: "#6c71c4",
      accent: "#2aa198",
      neutral: "#657b83",
      info: "#2aa198",
      success: "#859900",
      warning: "#b58900",
      error: "#dc322f",
      coloredContent: "#ffffff",
    }),
  },
  {
    id: "monokai",
    label: "Monokai",
    colors: createThemeColors({
      base100: "#272822",
      base200: "#3e3d32",
      base300: "#75715e",
      baseContent: "#f8f8f2",
      primary: "#66d9ef",
      secondary: "#ae81ff",
      accent: "#a6e22e",
      neutral: "#75715e",
      info: "#66d9ef",
      success: "#a6e22e",
      warning: "#e6db74",
      error: "#f92672",
    }),
  },
];

export type UiTheme = {
  accentColor: UiAccentColor;
  preset?: UiThemePresetId;
  colors?: UiThemeColors;
};
export const UI_FONT_SIZE_MIN = 10;
export const UI_FONT_SIZE_MAX = 32;
export const DEFAULT_CHAT_FONT_SIZE = 14;
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
  theme: { accentColor: "blue", preset: "daisyui" },
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
        parsed.version !== 5 &&
        parsed.version !== 6 &&
        parsed.version !== UI_PREFERENCES_VERSION)
    ) {
      return DEFAULT_UI_PREFERENCES;
    }

    const legacyColorScheme = parsed.version === 1 ? parsed.theme : undefined;
    const storedTheme = isRecord(parsed.theme) ? parsed.theme : undefined;
    const storedPreset = readOptionalEnum(
      storedTheme?.preset,
      UI_THEME_PRESET_IDS,
    );

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
        preset:
          storedPreset ??
          (storedTheme?.accentColor === undefined
            ? DEFAULT_UI_PREFERENCES.theme.preset
            : undefined),
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

function resolvedColorScheme(colorScheme: UiColorScheme): "light" | "dark" {
  if (colorScheme !== "system") {
    return colorScheme;
  }

  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeColors(theme: UiTheme): void {
  const presetColors = UI_THEME_PRESETS.find(
    (preset) => preset.id === theme.preset,
  )?.colors;
  const colors = { ...presetColors, ...(theme.colors ?? {}) };

  for (const key of UI_THEME_COLOR_KEYS) {
    const value = colors[key]?.trim();
    if (value) {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    } else {
      document.documentElement.style.removeProperty(`--color-${key}`);
    }
  }
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
    if (preferences.theme.preset) {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.dataset.accent = preferences.theme.accentColor;
    }
    applyThemeColors(preferences.theme);
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
