// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/app/i18n";

const useUiPreferences = vi.hoisted(() => vi.fn());

vi.mock("@/app/ui-preferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/ui-preferences")>()),
  useUiPreferences,
}));

describe("AppearancePage", () => {
  afterEach(cleanup);

  it("renders presentation preferences on their own settings tab", async () => {
    const update = vi.fn();
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
        theme: { accentColor: "blue", preset: "system" },
        chatFontFamily: "system-ui",
        chatFontSize: 12,
        uiFontFamily: "system-ui",
        uiFontSize: 14,
        uiZoom: 100,
      },
      update,
    });

    const { AppearancePage } = await import("./AppearancePage");

    render(
      <MemoryRouter>
        <AppearancePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Interface" })).toBeTruthy();
    expect(screen.queryByLabelText("Color mode")).toBeNull();
    expect(screen.getByText("Advanced theme colors")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Theme preset options" })).toBeTruthy();
    const selector = screen.getByTestId("theme-preset-selector");
    const selectorSummary = selector.querySelector("summary");
    const currentPreview = document.querySelector("[data-current-theme-preview] [data-theme-preview-panel]");
    if (!currentPreview) throw new Error("Current theme preview is missing");
    expect(selectorSummary?.contains(currentPreview)).toBe(false);
    expect(currentPreview.closest("details")).toBeNull();
    expect(currentPreview.querySelector("[data-theme-preview-header]")).toBeTruthy();
    expect(currentPreview.querySelector("[data-theme-preview-message]")).toBeTruthy();
    expect(currentPreview.querySelector("[data-theme-preview-composer]")).toBeTruthy();
    expect(currentPreview.querySelector("[data-theme-preview-send]")).toBeTruthy();
    expect(screen.getByLabelText("Chat font size")).toBeTruthy();
    expect(screen.getByLabelText("UI font size")).toBeTruthy();
    expect(screen.getByLabelText("Chat font")).toBeTruthy();
    expect(screen.getByLabelText("UI font")).toBeTruthy();
    expect(screen.getByLabelText("Zoom level")).toBeTruthy();
    expect(screen.queryByLabelText("Density")).toBeNull();
    const chatFontSize = screen.getByLabelText("Chat font size");
    expect(chatFontSize.getAttribute("type")).toBe("number");
    expect(chatFontSize.getAttribute("min")).toBe("10");
    expect(chatFontSize.getAttribute("max")).toBe("32");
    expect(chatFontSize.getAttribute("value")).toBe("12");
    expect(screen.getByLabelText("UI font size").getAttribute("value")).toBe("14");

    fireEvent.click(screen.getByRole("button", { name: "GitHub Dark" }));
    expect(update).toHaveBeenCalledWith({
      theme: {
        accentColor: "blue",
        colors: {},
        preset: "github-dark",
      },
    });
  });
  it("updates theme, typography and advanced color accessible names in Japanese", async () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        theme: { preset: "system", colors: {} },
        chatFontFamily: "system-ui",
        chatFontSize: 14,
        uiFontFamily: "system-ui",
        uiFontSize: 14,
        uiZoom: 100,
      },
      update: vi.fn(),
    });
    const { AppearancePage } = await import("./AppearancePage");
    render(<AppearancePage />);
    await act(() => i18n.changeLanguage("ja"));
    expect(screen.getByRole("heading", { name: "外観" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "チャットの文字サイズ" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "UIのフォント" })).toBeTruthy();
    const colors = screen.getByText("テーマカラーの詳細設定").closest("details");
    const summary = colors?.querySelector("summary");
    if (!summary) throw new Error("Theme colors summary is missing");
    fireEvent.click(summary);
    expect(screen.getByRole("textbox", { name: "プライマリーの色" })).toBeTruthy();
    expect(screen.getByText("システムから継承")).toBeTruthy();
  });
});
