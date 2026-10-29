// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
        colorScheme: "system",
        theme: { accentColor: "blue" },
        chatFontSize: 16,
        uiFontSize: 16,
      },
      update: vi.fn(),
    });

    const { AppearancePage } = await import("./AppearancePage");

    render(
      <MemoryRouter>
        <AppearancePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Interface" })).toBeTruthy();
    expect(screen.getByLabelText("Theme")).toBeTruthy();
    expect(screen.getByLabelText("Chat font size")).toBeTruthy();
    expect(screen.getByLabelText("UI font size")).toBeTruthy();
    expect(screen.queryByLabelText("Density")).toBeNull();
    const chatFontSize = screen.getByLabelText("Chat font size");
    expect(chatFontSize.getAttribute("type")).toBe("number");
    expect(chatFontSize.getAttribute("min")).toBe("10");
    expect(chatFontSize.getAttribute("max")).toBe("32");
    expect(chatFontSize.getAttribute("value")).toBe("16");
  });
});
