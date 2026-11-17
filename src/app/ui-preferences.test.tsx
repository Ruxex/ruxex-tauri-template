// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "./i18n";

import {
  clampUiZoom,
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

  it("clamps zoom to five-point steps between 75% and 125%", () => {
    expect(clampUiZoom(74)).toBe(75);
    expect(clampUiZoom(83)).toBe(85);
    expect(clampUiZoom(129)).toBe(125);
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

  it("updates presentation preferences with the current version", () => {
    const next = updateUiPreferences(DEFAULT_UI_PREFERENCES, {
      theme: { accentColor: "rose", preset: "ruxex-light" },
    });

    expect(next).toMatchObject({
      version: 10,
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

function LanguageProbe() {
  const { update } = useUiPreferences();
  const { t } = useTranslation("common");
  return (
    <>
      <output>{t("actions.close")}</output>
      <button type="button" onClick={() => update({ language: "ja" })}>
        Japanese
      </button>
      <button type="button" onClick={() => update({ language: "en" })}>
        English
      </button>
    </>
  );
}

describe("UI language synchronization", () => {
  afterEach(cleanup);
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads persisted Japanese and synchronizes i18next with the document", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_UI_PREFERENCES, language: "ja" }),
    );
    render(
      <UiPreferencesProvider>
        <LanguageProbe />
      </UiPreferencesProvider>,
    );
    expect(i18n.resolvedLanguage).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("updates visible strings and document language without remounting", () => {
    render(
      <UiPreferencesProvider>
        <LanguageProbe />
      </UiPreferencesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
    expect(i18n.resolvedLanguage).toBe("ja");
    expect(screen.getByRole("status").textContent).toBe("閉じる");
    expect(document.documentElement.lang).toBe("ja");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("status").textContent).toBe("Close");
    expect(document.documentElement.lang).toBe("en");
  });

  it("follows languagechange only while system language is selected", () => {
    const systemLanguage = vi
      .spyOn(navigator, "language", "get")
      .mockReturnValue("en-US");
    const view = render(
      <UiPreferencesProvider>
        <LanguageProbe />
      </UiPreferencesProvider>,
    );
    systemLanguage.mockReturnValue("ja-JP");
    act(() => window.dispatchEvent(new Event("languagechange")));
    expect(i18n.resolvedLanguage).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    act(() => window.dispatchEvent(new Event("languagechange")));
    expect(i18n.resolvedLanguage).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    view.unmount();
    act(() => window.dispatchEvent(new Event("languagechange")));
    expect(i18n.resolvedLanguage).toBe("en");
    systemLanguage.mockRestore();
  });
});

describe("cross-window UI preferences", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  function PreferencesProbe() {
    const { preferences, update } = useUiPreferences();
    return (
      <>
        <output data-testid="preferences">{JSON.stringify(preferences)}</output>
        <button type="button" onClick={() => update({ language: "en" })}>
          English
        </button>
      </>
    );
  }

  function notifyStorage(
    key: string | null = UI_PREFERENCES_KEY,
    storageArea = window.localStorage,
  ) {
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: storageArea.getItem(UI_PREFERENCES_KEY),
          storageArea,
        }),
      ),
    );
  }

  it("adopts normalized external preferences without writing them back, then preserves them on local updates", () => {
    const view = render(
      <UiPreferencesProvider>
        <PreferencesProbe />
      </UiPreferencesProvider>,
    );
    const external = {
      ...DEFAULT_UI_PREFERENCES,
      language: "ja",
      sidebarCollapsed: true,
      chatFontSize: 23,
      uiFontSize: 19,
      uiZoom: 115,
      chatFontFamily: "Inter",
      uiFontFamily: "Inter",
      notifications: { desktop: false, sound: "Ping" },
      theme: {
        accentColor: "rose",
        preset: "ruxex-light",
        colors: { primary: "#123456" },
      },
    };
    const newValue = JSON.stringify(external);
    window.localStorage.setItem(UI_PREFERENCES_KEY, newValue);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    notifyStorage();
    expect(
      JSON.parse(screen.getByTestId("preferences").textContent ?? "{}"),
    ).toEqual(parseUiPreferences(newValue));
    expect(i18n.resolvedLanguage).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(UI_PREFERENCES_KEY)).toBe(newValue);

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toEqual({ ...parseUiPreferences(newValue), language: "en" });
    view.unmount();
    window.localStorage.setItem(UI_PREFERENCES_KEY, newValue);
    notifyStorage();
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("ignores unrelated keys and session-storage events", () => {
    render(
      <UiPreferencesProvider>
        <PreferencesProbe />
      </UiPreferencesProvider>,
    );
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_UI_PREFERENCES, language: "ja" }),
    );
    notifyStorage("other-key");
    notifyStorage(UI_PREFERENCES_KEY, window.sessionStorage);
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("uses current storage instead of replaying an older queued storage event", () => {
    render(
      <UiPreferencesProvider>
        <PreferencesProbe />
      </UiPreferencesProvider>,
    );
    const staleValue = JSON.stringify({
      ...DEFAULT_UI_PREFERENCES,
      language: "en",
    });
    const latestValue = JSON.stringify({
      ...DEFAULT_UI_PREFERENCES,
      language: "ja",
      uiZoom: 120,
    });
    window.localStorage.setItem(UI_PREFERENCES_KEY, latestValue);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: UI_PREFERENCES_KEY,
          newValue: staleValue,
          storageArea: window.localStorage,
        }),
      ),
    );
    expect(
      JSON.parse(screen.getByTestId("preferences").textContent ?? "{}"),
    ).toEqual(parseUiPreferences(latestValue));
    expect(window.localStorage.getItem(UI_PREFERENCES_KEY)).toBe(latestValue);
  });

  it("merges a local update with external values before their storage event is delivered", () => {
    render(
      <UiPreferencesProvider>
        <PreferencesProbe />
      </UiPreferencesProvider>,
    );
    const external = {
      ...DEFAULT_UI_PREFERENCES,
      language: "ja",
      uiZoom: 120,
      sidebarCollapsed: true,
    };
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(external));
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "{}"),
    ).toEqual({
      ...parseUiPreferences(JSON.stringify(external)),
      language: "en",
    });
  });

  it("resets cleared preferences without restoring the removed key", () => {
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_UI_PREFERENCES, language: "ja" }),
    );
    render(
      <UiPreferencesProvider>
        <PreferencesProbe />
      </UiPreferencesProvider>,
    );
    window.localStorage.clear();
    notifyStorage(null);
    expect(
      JSON.parse(screen.getByTestId("preferences").textContent ?? "{}"),
    ).toEqual(DEFAULT_UI_PREFERENCES);
    expect(window.localStorage.getItem(UI_PREFERENCES_KEY)).toBeNull();
  });
});
