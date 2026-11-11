import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
  UI_THEME_PRESETS,
  UI_THEME_COLOR_KEYS,
  UI_NOTIFICATION_SOUND_OPTIONS,
  getUiThemePresetMode,
  getUiThemePresetPreview,
  updateUiPreferences,
} from "./ui-preferences";

describe("ui preferences", () => {
  it("uses a 14px chat font by default", () => {
    expect(DEFAULT_CHAT_FONT_SIZE).toBe(14);
  });

  it("uses safe defaults when no local preference exists", () => {
    expect(parseUiPreferences(null)).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it("parses supported DaisyUI color overrides and ignores unknown values", () => {
    const parsed = parseUiPreferences(
      JSON.stringify({
        ...DEFAULT_UI_PREFERENCES,
        theme: {
          accentColor: "blue",
          colors: {
            primary: "#123456",
            "base-100": "oklch(98% 0 0)",
            unknown: "red",
            warning: "",
          },
        },
      }),
    );

    expect(UI_THEME_COLOR_KEYS).toContain("primary");
    expect(parsed.theme.colors).toEqual({
      primary: "#123456",
      "base-100": "oklch(98% 0 0)",
    });
  });

  it("exposes the system and Ruxex built-in theme presets", () => {
    expect(UI_THEME_PRESETS).toHaveLength(15);
    expect(UI_THEME_PRESETS.map((preset) => preset.label)).toEqual([
      "System",
      "Ruxex Light",
      "Ruxex Dark",
      "Ruxex Ink & Mint",
      "VS Code Dark+",
      "GitHub Light",
      "GitHub Dark",
      "Dracula",
      "Nord",
      "Solarized Light",
      "Monokai",
      "Tokyo Night",
      "Catppuccin Mocha",
      "Gruvbox Dark",
      "One Dark",
    ]);
  });

  it("exposes the optional Ink & Mint preset as a dark original palette", () => {
    const inkAndMint = UI_THEME_PRESETS.find(
      (preset) => preset.id === "ruxex-ink-mint",
    );

    expect(inkAndMint).toBeTruthy();
    if (!inkAndMint) throw new Error("Ink & Mint theme preset missing");
    expect(getUiThemePresetMode("ruxex-ink-mint")).toBe("dark");
    expect(getUiThemePresetPreview(inkAndMint).primary).toBe("#4fd1c5");
  });

  it("keeps the default theme preview independent from the active CSS theme", () => {
    const system = UI_THEME_PRESETS.find((preset) => preset.id === "system");
    const catppuccin = UI_THEME_PRESETS.find(
      (preset) => preset.id === "catppuccin-mocha",
    );

    expect(system).toBeTruthy();
    expect(catppuccin).toBeTruthy();
    if (!system || !catppuccin) throw new Error("Theme preset missing");
    const defaultPreview = getUiThemePresetPreview(system);
    const catppuccinPreview = getUiThemePresetPreview(catppuccin);

    expect(defaultPreview.background).not.toMatch(/^var\(/);
    expect(defaultPreview.surface).not.toMatch(/^var\(/);
    expect(defaultPreview.primary).not.toMatch(/^var\(/);
    expect(defaultPreview.background).not.toBe(catppuccinPreview.background);
    expect(getUiThemePresetMode(system.id)).toBe("system");

    const dracula = UI_THEME_PRESETS.find((preset) => preset.id === "dracula");
    expect(dracula).toBeTruthy();
    if (!dracula) throw new Error("Theme preset missing");
    expect(getUiThemePresetPreview(dracula).muted).not.toBe(
      getUiThemePresetPreview(dracula).card,
    );
  });

  it("uses a modern Ruxex palette for the default theme", () => {
    const system = UI_THEME_PRESETS.find((preset) => preset.id === "system");

    expect(system).toBeTruthy();
    if (!system) throw new Error("System theme preset missing");
    const lightPreview = getUiThemePresetPreview(system, "light");
    expect(lightPreview.primary).toBe("#3b82f6");
    expect(lightPreview.secondary).toBe("#8b5cf6");
    expect(lightPreview.accent).toBe("#14b8a6");
    expect(lightPreview.surface).toBe("#fefefe");
    expect(lightPreview.primaryContent).toBe("#fefefe");
    expect(getUiThemePresetPreview(system, "dark").primary).toBe("#60a5fa");
  });

  it("rejects a preference record from an unknown version", () => {
    expect(
      parseUiPreferences(
        JSON.stringify({ version: 99, sidebarCollapsed: true }),
      ),
    ).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it("applies only supported presentation preference updates", () => {
    expect(
      updateUiPreferences(DEFAULT_UI_PREFERENCES, {
        sidebarCollapsed: true,
        theme: { accentColor: "violet", preset: "ruxex-dark" },
      }),
    ).toEqual({
      ...DEFAULT_UI_PREFERENCES,
      sidebarCollapsed: true,
      theme: { accentColor: "violet", preset: "ruxex-dark" },
    });
  });

  it("migrates the previous light-dark theme value", () => {
    expect(
      parseUiPreferences(JSON.stringify({ version: 1, theme: "dark" })),
    ).toMatchObject({
      theme: { accentColor: "blue", preset: "ruxex-dark" },
    });
  });

  it("migrates the former DaisyUI preset and color mode values", () => {
    expect(
      parseUiPreferences(
        JSON.stringify({
          version: 7,
          colorScheme: "light",
          theme: { accentColor: "blue", preset: "daisyui" },
        }),
      ),
    ).toMatchObject({ theme: { preset: "ruxex-light" } });
  });

  it("parses every notification sound declared by the option metadata", () => {
    for (const option of UI_NOTIFICATION_SOUND_OPTIONS) {
      expect(
        parseUiPreferences(
          JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            notifications: { desktop: true, sound: option.value },
          }),
        ).notifications.sound,
      ).toBe(option.value);
    }
  });
});
