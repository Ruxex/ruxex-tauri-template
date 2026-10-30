// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAddMarketplace = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());
const useRemoveMarketplace = vi.hoisted(() => vi.fn());
const useUpgradeMarketplace = vi.hoisted(() => vi.fn());
const addMarketplace = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
const removeMarketplace = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
const upgradeMarketplace = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock("../app-server/hooks", () => ({
  useAddMarketplace,
  usePluginList,
  useRemoveMarketplace,
  useUpgradeMarketplace,
}));

describe("MarketplaceSettingsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    addMarketplace.mutateAsync.mockReset();
    addMarketplace.mutateAsync.mockResolvedValue({});
    removeMarketplace.mutateAsync.mockReset();
    removeMarketplace.mutateAsync.mockResolvedValue({});
    upgradeMarketplace.mutateAsync.mockReset();
    upgradeMarketplace.mutateAsync.mockResolvedValue({});
    useAddMarketplace.mockReturnValue(addMarketplace);
    useRemoveMarketplace.mockReturnValue(removeMarketplace);
    useUpgradeMarketplace.mockReturnValue(upgradeMarketplace);
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [{ id: "example" }],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  it("validates a blank source before calling the server", async () => {
    const { MarketplaceSettingsPage } = await import(
      "./MarketplaceSettingsPage"
    );

    const { container } = render(
      <MemoryRouter>
        <MarketplaceSettingsPage />
      </MemoryRouter>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("max-w-3xl");
    fireEvent.click(screen.getByRole("button", { name: "Add marketplace" }));

    expect(screen.getByText("Marketplace source is required.")).toBeTruthy();
    expect(addMarketplace.mutateAsync).not.toHaveBeenCalled();
  });

  it("adds a marketplace with its ref and sparse paths", async () => {
    const { MarketplaceSettingsPage } = await import(
      "./MarketplaceSettingsPage"
    );

    render(
      <MemoryRouter>
        <MarketplaceSettingsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "https://example.com/marketplace.git" },
    });
    fireEvent.change(screen.getByLabelText("Git ref (optional)"), {
      target: { value: "main" },
    });
    fireEvent.change(screen.getByLabelText("Sparse paths (optional)"), {
      target: { value: "plugins/a, plugins/b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add marketplace" }));

    expect(addMarketplace.mutateAsync).toHaveBeenCalledWith({
      source: "https://example.com/marketplace.git",
      refName: "main",
      sparsePaths: ["plugins/a", "plugins/b"],
    });
  });

  it("lists marketplaces and exposes upgrade and remove actions", async () => {
    const { MarketplaceSettingsPage } = await import(
      "./MarketplaceSettingsPage"
    );

    render(
      <MemoryRouter>
        <MarketplaceSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Community Plugins")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update community" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove community" }));

    expect(upgradeMarketplace.mutateAsync).toHaveBeenCalledWith({
      marketplaceName: "community",
    });
    expect(removeMarketplace.mutateAsync).toHaveBeenCalledWith({
      marketplaceName: "community",
    });
  });
});
