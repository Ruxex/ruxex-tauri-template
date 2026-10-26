import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
  UI_NOTIFICATION_SOUND_OPTIONS,
  updateUiPreferences,
} from "./ui-preferences";

describe("ui preferences", () => {
  it("uses safe defaults when no local preference exists", () => {
    expect(parseUiPreferences(null)).toEqual(DEFAULT_UI_PREFERENCES);
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
