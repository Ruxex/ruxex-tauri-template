import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
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
        contextTab: "changes",
        theme: "dark",
      }),
    ).toEqual({
      ...DEFAULT_UI_PREFERENCES,
      sidebarCollapsed: true,
      contextTab: "changes",
      theme: "dark",
    });
  });
});
