// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
  UI_NOTIFICATION_SOUNDS,
  UI_PREFERENCES_KEY,
  UiPreferencesProvider,
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
          chatFontSize: 24,
          colorScheme: "dark",
          theme: { accentColor: "violet" },
          uiFontSize: 12,
        })
      }
    >
      {preferences.colorScheme}:{preferences.theme.accentColor}:
      {preferences.chatFontSize}px:{preferences.uiFontSize}px
    </button>
  );
}

describe("UI preference persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
    document.documentElement.removeAttribute("data-chat-font-size");
    document.documentElement.removeAttribute("data-ui-font-size");
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
          colorScheme: "dark",
          theme: { accentColor: "violet" },
          chatFontSize: 24,
          uiFontSize: 12,
        }),
      ),
    ).toMatchObject({
      sidebarCollapsed: true,
      colorScheme: "dark",
      theme: { accentColor: "violet" },
      chatFontSize: 24,
      uiFontSize: 12,
    });
    expect(
      parseUiPreferences(
        JSON.stringify({
          version: 4,
          notifications: { desktop: true, sound: "message-new-instant" },
        }),
      ),
    ).toMatchObject({
      notifications: { desktop: true, sound: "message-new-instant" },
    });
    expect(UI_NOTIFICATION_SOUNDS).toContain("system");
  });

  it("updates presentation preferences without changing the version", () => {
    const next = updateUiPreferences(DEFAULT_UI_PREFERENCES, {
      colorScheme: "light",
      theme: { accentColor: "rose" },
    });

    expect(next).toMatchObject({
      version: 5,
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
      "light:emerald:12px:14px",
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("emerald");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe(
      "dark:violet:24px:12px",
    );
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toMatchObject({
      colorScheme: "dark",
      theme: { accentColor: "violet" },
      chatFontSize: 24,
      uiFontSize: 12,
    });
    expect(document.documentElement.dataset.chatFontSize).toBeUndefined();
    expect(document.documentElement.dataset.uiFontSize).toBe("12");
  });

  it("resolves system color mode from the OS preference", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMedia,
    });

    render(
      <UiPreferencesProvider>
        <Probe />
      </UiPreferencesProvider>,
    );

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
