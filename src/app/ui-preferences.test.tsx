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
          chatFontFamily: "Inter",
          theme: { accentColor: "violet", preset: "ruxex-dark" },
          uiFontSize: 12,
          uiFontFamily: "Inter",
        })
      }
    >
      {preferences.theme.preset}:{preferences.theme.accentColor}:
      {preferences.chatFontSize}px:{preferences.uiFontSize}px:
      {preferences.chatFontFamily}:{preferences.uiFontFamily}
    </button>
  );
}

describe("UI preference persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
    document.documentElement.removeAttribute("data-accent");
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
          version: 7,
          sidebarCollapsed: true,
          colorScheme: "dark",
          theme: { accentColor: "violet" },
          chatFontSize: 24,
          uiFontSize: 12,
        }),
      ),
    ).toMatchObject({
      sidebarCollapsed: true,
      theme: { accentColor: "violet", preset: "ruxex-dark" },
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
      theme: { accentColor: "rose", preset: "ruxex-light" },
    });

    expect(next).toMatchObject({
      version: 9,
      theme: { accentColor: "rose", preset: "ruxex-light" },
    });
  });

  it("loads, persists, and applies provider preferences to document data attributes", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_UI_PREFERENCES,
        theme: {
          accentColor: "emerald",
          preset: "ruxex-light",
          colors: { primary: "#123456" },
        },
      }),
    );
    render(
      <UiPreferencesProvider>
        <Probe />
      </UiPreferencesProvider>,
    );

    expect(screen.getByRole("button").textContent).toBe(
      "ruxex-light:emerald:14px:14px:system-ui:system-ui",
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      document.documentElement.style.getPropertyValue("--ruxex-ui-font-family"),
    ).toBe("system-ui");
    expect(
      document.documentElement.style.getPropertyValue(
        "--ruxex-chat-font-family",
      ),
    ).toBe("system-ui");
    expect(document.documentElement.dataset.accent).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue("--color-primary"),
    ).toBe("#123456");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe(
      "ruxex-dark:violet:24px:12px:Inter:Inter",
    );
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toMatchObject({
      theme: { accentColor: "violet" },
      chatFontSize: 24,
      chatFontFamily: "Inter",
      uiFontSize: 12,
      uiFontFamily: "Inter",
    });
    expect(document.documentElement.dataset.chatFontSize).toBeUndefined();
    expect(document.documentElement.dataset.uiFontSize).toBe("12");
    expect(
      document.documentElement.style.getPropertyValue("--ruxex-ui-font-family"),
    ).toBe("Inter");
    expect(
      document.documentElement.style.getPropertyValue(
        "--ruxex-chat-font-family",
      ),
    ).toBe("Inter");
  });

  it("applies a selected theme preset to DaisyUI variables", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_UI_PREFERENCES,
        theme: {
          accentColor: "blue",
          preset: "github-dark",
          colors: {},
        },
      }),
    );

    render(
      <UiPreferencesProvider>
        <Probe />
      </UiPreferencesProvider>,
    );

    expect(
      document.documentElement.style.getPropertyValue("--color-base-100"),
    ).toBe("#0d1117");
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("resolves the System theme from the OS preference", () => {
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
    expect(
      document.documentElement.style.getPropertyValue("--color-base-100"),
    ).toBe("#111827");
  });
});
