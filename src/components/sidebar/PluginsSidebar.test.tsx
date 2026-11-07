// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const usePluginList = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({ usePluginList }));

describe("PluginsSidebar", () => {
  afterEach(cleanup);

  it("marks the active capability tab and shows the installed count", async () => {
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "official",
            plugins: [{ id: "calendar", name: "Calendar", installed: true }],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    const { PluginsSidebar } = await import("./PluginsSidebar");
    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <PluginsSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("button", { name: "Skills" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("button", { name: "Skills" }).className).toContain(
      "menu-active",
    );
    expect(
      screen
        .getByRole("button", { name: "Plugins" })
        .getAttribute("aria-current"),
    ).toBeNull();
    expect(screen.getByText("Installed (1)")).toBeTruthy();
  });
});
