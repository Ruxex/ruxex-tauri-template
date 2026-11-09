// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());

vi.mock("../app/ui-preferences", async (importOriginal) => ({
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
        chatFontSize: 12,
        uiFontSize: 14,
      },
      update,
    });

    const { AppearancePage } = await import("./AppearancePage");

    render(
      <MemoryRouter>
        <AppearancePage />
      </MemoryRouter>,
    );

    const heading = screen.getByRole("heading", { name: "Appearance" });
    expect(heading.className).toContain("text-3xl");
    expect(heading.className).toContain("tracking-tight");
    expect(screen.getByRole("heading", { name: "Interface" })).toBeTruthy();
    expect(screen.queryByLabelText("Color mode")).toBeNull();
    expect(screen.getByText("Advanced theme colors")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Theme preset options" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Chat font size")).toBeTruthy();
    expect(screen.getByLabelText("UI font size")).toBeTruthy();
    expect(screen.queryByLabelText("Density")).toBeNull();
    const chatFontSize = screen.getByLabelText("Chat font size");
    expect(chatFontSize.getAttribute("type")).toBe("number");
    expect(chatFontSize.getAttribute("min")).toBe("10");
    expect(chatFontSize.getAttribute("max")).toBe("32");
    expect(chatFontSize.getAttribute("value")).toBe("12");
    expect(screen.getByLabelText("UI font size").getAttribute("value")).toBe(
      "14",
    );

    fireEvent.click(screen.getByRole("button", { name: "GH Dark" }));
    expect(update).toHaveBeenCalledWith({
      theme: {
        accentColor: "blue",
        colors: {},
        preset: "github-dark",
      },
    });
  });
});
