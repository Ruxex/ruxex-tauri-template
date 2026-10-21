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
      onClick={() =>
        update({
          colorScheme: "dark",
          density: "compact",
          theme: { accentColor: "violet" },
        })
      }
    >
      {preferences.colorScheme}:{preferences.theme.accentColor}:
      {preferences.density}
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
          colorScheme: "dark",
          theme: { accentColor: "violet" },
          density: "compact",
        }),
      ),
    ).toMatchObject({
      sidebarCollapsed: true,
      contextDrawerOpen: true,
      contextTab: "activity",
      colorScheme: "dark",
      theme: { accentColor: "violet" },
      density: "compact",
    });
  });

  it("updates presentation preferences without changing the version", () => {
    const next = updateUiPreferences(DEFAULT_UI_PREFERENCES, {
      colorScheme: "light",
      theme: { accentColor: "rose" },
    });

    expect(next).toMatchObject({
      version: 3,
      colorScheme: "light",
      theme: { accentColor: "rose" },
    });
    expect(DEFAULT_UI_PREFERENCES.colorScheme).toBe("system");
  });

  it("loads, persists, and applies provider preferences to document data attributes", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_UI_PREFERENCES,
        colorScheme: "light",
        theme: { accentColor: "emerald" },
      }),
    );
    render(
      <UiPreferencesProvider>
        <Probe />
      </UiPreferencesProvider>,
    );

    expect(screen.getByRole("button").textContent).toBe(
      "light:emerald:comfortable",
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("emerald");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("dark:violet:compact");
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toMatchObject({
      colorScheme: "dark",
      theme: { accentColor: "violet" },
      density: "compact",
    });
    expect(document.documentElement.dataset.density).toBe("compact");
  });
});
