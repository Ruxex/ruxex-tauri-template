import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
  UI_THEME_PRESETS,
  UI_THEME_COLOR_KEYS,
  UI_NOTIFICATION_SOUND_OPTIONS,
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

  it("exposes twelve built-in theme presets", () => {
    expect(UI_THEME_PRESETS).toHaveLength(12);
    expect(UI_THEME_PRESETS.map((preset) => preset.label)).toEqual([
      "DaisyUI Default",
      "VS Code Dark+",
      "GH Light",
      "GH Dark",
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
        colorScheme: "dark",
        theme: { accentColor: "violet" },
      }),
    ).toEqual({
      ...DEFAULT_UI_PREFERENCES,
      sidebarCollapsed: true,
      colorScheme: "dark",
      theme: { accentColor: "violet" },
    });
  });

  it("migrates the previous light-dark theme value", () => {
    expect(
      parseUiPreferences(JSON.stringify({ version: 1, theme: "dark" })),
    ).toMatchObject({
      colorScheme: "dark",
      theme: { accentColor: "blue" },
    });
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
