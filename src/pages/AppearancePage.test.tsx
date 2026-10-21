// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());

vi.mock("../app/ui-preferences", () => ({ useUiPreferences }));

describe("AppearancePage", () => {
  afterEach(cleanup);

  it("renders presentation preferences on their own settings tab", async () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
        contextDrawerOpen: true,
        theme: "system",
        density: "comfortable",
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
  });
});
