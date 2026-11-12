import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export const UI_PREFERENCES_KEY = "ruxex.ui-preferences";
const UI_PREFERENCES_VERSION = 9;

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
export type UiThemePresetMode = "system" | "light" | "dark";
export type UiThemePresetPreview = {
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  primaryContent: string;
  secondary: string;
  accent: string;
  accentContent: string;
};
export const UI_THEME_PRESET_IDS = [
  "system",
  "ruxex-light",
  "ruxex-dark",
  "ruxex-ink-mint",
  "vscode-dark",
  "github-light",
  "github-dark",
  "dracula",
  "nord",
  "solarized-light",
  "monokai",
  "tokyo-night",
  "catppuccin-mocha",
  "gruvbox-dark",
  "one-dark",
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

const RUXEX_LIGHT_COLORS = createThemeColors({
  base100: "#fefefe",
  base200: "#f6f8fc",
  base300: "#dbe4f0",
  baseContent: "#172033",
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  accent: "#14b8a6",
  neutral: "#334155",
  info: "#0ea5e9",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  coloredContent: "#fefefe",
});

const RUXEX_DARK_COLORS = createThemeColors({
  base100: "#111827",
  base200: "#0f172a",
  base300: "#1e293b",
  baseContent: "#e2e8f0",
  primary: "#60a5fa",
  secondary: "#c084fc",
  accent: "#5eead4",
  neutral: "#64748b",
  info: "#38bdf8",
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#fb7185",
  coloredContent: "#0f172a",
});

const RUXEX_INK_MINT_COLORS = createThemeColors({
  base100: "#121a18",
  base200: "#0d1412",
  base300: "#22312c",
  baseContent: "#e6efe9",
  primary: "#4fd1c5",
  secondary: "#f6ad55",
  accent: "#fb7185",
  neutral: "#718096",
  info: "#63b3ed",
  success: "#68d391",
  warning: "#f6e05e",
  error: "#fc8181",
  coloredContent: "#13211d",
});

export const UI_THEME_PRESETS: readonly UiThemePreset[] = [
  { id: "system", label: "System", colors: {} },
  { id: "ruxex-light", label: "Ruxex Light", colors: RUXEX_LIGHT_COLORS },
  { id: "ruxex-dark", label: "Ruxex Dark", colors: RUXEX_DARK_COLORS },
  {
    id: "ruxex-ink-mint",
    label: "Ruxex Ink & Mint",
    colors: RUXEX_INK_MINT_COLORS,
  },
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
    label: "GitHub Light",
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
    label: "GitHub Dark",
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
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    colors: createThemeColors({
      base100: "#1a1b26",
      base200: "#16161e",
      base300: "#292e42",
      baseContent: "#a9b1d6",
      primary: "#7aa2f7",
      secondary: "#bb9af7",
      accent: "#7dcfff",
      neutral: "#565f89",
      info: "#2ac3de",
      success: "#9ece6a",
      warning: "#e0af68",
      error: "#f7768e",
      coloredContent: "#1a1b26",
    }),
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    colors: createThemeColors({
      base100: "#1e1e2e",
      base200: "#181825",
      base300: "#313244",
      baseContent: "#cdd6f4",
      primary: "#cba6f7",
      secondary: "#f5c2e7",
      accent: "#94e2d5",
      neutral: "#6c7086",
      info: "#89dceb",
      success: "#a6e3a1",
      warning: "#f9e2af",
      error: "#f38ba8",
      coloredContent: "#1e1e2e",
    }),
  },
  {
    id: "gruvbox-dark",
    label: "Gruvbox Dark",
    colors: createThemeColors({
      base100: "#282828",
      base200: "#3c3836",
      base300: "#504945",
      baseContent: "#ebdbb2",
      primary: "#83a598",
      secondary: "#d3869b",
      accent: "#b8bb26",
      neutral: "#928374",
      info: "#8ec07c",
      success: "#b8bb26",
      warning: "#fabd2f",
      error: "#fb4934",
      coloredContent: "#282828",
    }),
  },
  {
    id: "one-dark",
    label: "One Dark",
    colors: createThemeColors({
      base100: "#282c34",
      base200: "#31353f",
      base300: "#393f4a",
      baseContent: "#abb2bf",
      primary: "#61afef",
      secondary: "#c678dd",
      accent: "#56b6c2",
      neutral: "#5c6370",
      info: "#61afef",
      success: "#98c379",
      warning: "#e5c07b",
      error: "#e86671",
      coloredContent: "#282c34",
    }),
  },
];

const DARK_THEME_PRESET_IDS = new Set<UiThemePresetId>([
  "ruxex-dark",
  "ruxex-ink-mint",
  "vscode-dark",
  "github-dark",
  "dracula",
  "nord",
  "monokai",
  "tokyo-night",
  "catppuccin-mocha",
  "gruvbox-dark",
  "one-dark",
]);

export function getUiThemePresetMode(
  preset: UiThemePresetId,
): UiThemePresetMode {
  if (preset === "system") return "system";
  return DARK_THEME_PRESET_IDS.has(preset) ? "dark" : "light";
}

function getUiThemePresetColors(
  preset: UiThemePreset,
  mode: "light" | "dark",
): UiThemeColors {
  if (preset.id === "system") {
    return mode === "dark" ? RUXEX_DARK_COLORS : RUXEX_LIGHT_COLORS;
  }
  return preset.colors;
}

export function getUiThemePresetPreview(
  preset: UiThemePreset,
  mode: "light" | "dark" = "light",
): UiThemePresetPreview {
  const colors = getUiThemePresetColors(preset, mode);
  return {
    background: colors["base-200"] ?? "#f4f4f5",
    surface: colors["base-100"] ?? "#ffffff",
    card: colors["base-300"] ?? colors["base-200"] ?? "#e4e4e7",
    text: colors["base-content"] ?? "#27272a",
    muted: colors["base-content"] ?? colors.neutral ?? "#71717a",
    primary: colors.primary ?? "#4f46e5",
    primaryContent: colors["primary-content"] ?? "#ffffff",
    secondary: colors.secondary ?? "#c026d3",
    accent: colors.accent ?? "#14b8a6",
    accentContent: colors["accent-content"] ?? "#ffffff",
  };
}

export type UiTheme = {
  accentColor: UiAccentColor;
  preset?: UiThemePresetId;
  colors?: UiThemeColors;
};
export const UI_FONT_SIZE_MIN = 10;
export const UI_FONT_SIZE_MAX = 32;
export const DEFAULT_CHAT_FONT_SIZE = 14;
export const DEFAULT_UI_FONT_SIZE = 14;
export const DEFAULT_FONT_FAMILY = "system-ui";
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

function applyThemeColors(theme: UiTheme, mode: "light" | "dark"): void {
  const preset =
    UI_THEME_PRESETS.find((preset) => preset.id === theme.preset) ??
    UI_THEME_PRESETS[0];
  const presetColors = getUiThemePresetColors(preset, mode);
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
      applyThemeColors(preferences.theme, mode);
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
