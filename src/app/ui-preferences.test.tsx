// @vitest-environment jsdom

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_KEY,
  UiPreferencesProvider,
  parseUiPreferences,
  updateUiPreferences,
  useUiPreferences,
} from "./ui-preferences";

function Probe() {
  const { preferences, update } = useUiPreferences();
  return (
    <button
      type="button"
      onClick={() => update({ density: "compact", theme: "dark" })}
    >
      {preferences.theme}:{preferences.density}
    </button>
  );
}

describe("UI preference persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
    document.documentElement.dataset.density = "";
  });

  it("uses defaults for missing, malformed, and versioned data", () => {
    expect(parseUiPreferences(null)).toEqual(DEFAULT_UI_PREFERENCES);
    expect(parseUiPreferences("not json")).toEqual(DEFAULT_UI_PREFERENCES);
    expect(parseUiPreferences(JSON.stringify({ version: 99 }))).toEqual(
      DEFAULT_UI_PREFERENCES,
    );
  });

  it("keeps valid values and repairs invalid individual fields", () => {
    expect(
      parseUiPreferences(
        JSON.stringify({
          version: 1,
          sidebarCollapsed: true,
          contextDrawerOpen: "yes",
          contextTab: "unknown",
          theme: "dark",
          density: "compact",
        }),
      ),
    ).toMatchObject({
      sidebarCollapsed: true,
      contextDrawerOpen: true,
      contextTab: "activity",
      theme: "dark",
      density: "compact",
    });
  });

  it("updates presentation preferences without changing the version", () => {
    const next = updateUiPreferences(DEFAULT_UI_PREFERENCES, {
      theme: "light",
    });

    expect(next).toMatchObject({ version: 1, theme: "light" });
    expect(DEFAULT_UI_PREFERENCES.theme).toBe("system");
  });

  it("loads, persists, and applies provider preferences to document data attributes", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_UI_PREFERENCES, theme: "light" }),
    );
    render(
      <UiPreferencesProvider>
        <Probe />
      </UiPreferencesProvider>,
    );

    expect(screen.getByRole("button").textContent).toBe("light:comfortable");
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("dark:compact");
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toMatchObject({ theme: "dark", density: "compact" });
    expect(document.documentElement.dataset.density).toBe("compact");
  });
});
