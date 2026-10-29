// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCollaborationModes = vi.hoisted(() => vi.fn());
const useConfig = vi.hoisted(() => vi.fn());
const useConfigRequirements = vi.hoisted(() => vi.fn());
const useMcpServerStatus = vi.hoisted(() => vi.fn());
const useInstallPlugin = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());
const useReloadMcpServers = vi.hoisted(() => vi.fn());
const useSkillsList = vi.hoisted(() => vi.fn());
const useUpgradeMarketplace = vi.hoisted(() => vi.fn());
const reloadMcp = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
const installPlugin = vi.hoisted(() => ({
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
  useCollaborationModes,
  useConfig,
  useConfigRequirements,
  useMcpServerStatus,
  useInstallPlugin,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
  useUpgradeMarketplace,
}));

describe("CapabilitiesPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    reloadMcp.mutateAsync.mockReset();
    reloadMcp.mutateAsync.mockResolvedValue({});
    useReloadMcpServers.mockReturnValue(reloadMcp);
    installPlugin.mutateAsync.mockReset();
    installPlugin.mutateAsync.mockResolvedValue({});
    useInstallPlugin.mockReturnValue(installPlugin);
    upgradeMarketplace.mutateAsync.mockReset();
    upgradeMarketplace.mutateAsync.mockResolvedValue({});
    useUpgradeMarketplace.mockReturnValue(upgradeMarketplace);
    useConfig.mockReturnValue({ data: { config: null } });
    useConfigRequirements.mockReturnValue({ data: { requirements: null } });
    useMcpServerStatus.mockReturnValue({
      data: {
        data: [
          {
            name: "docs",
            runtimeStatus: "connected",
            tools: { search: {} },
            authStatus: "notLoggedIn",
            toolsError: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useSkillsList.mockReturnValue({
      data: {
        data: [{ cwd: "/workspace", skills: [{ name: "review" }], errors: [] }],
      },
      isLoading: false,
      isError: false,
    });
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "official",
            path: "/tmp/official",
            interface: { displayName: "Official Plugins" },
            plugins: [
              {
                id: "lint",
                name: "Lint Plugin",
                interface: {
                  displayName: "Lint Plugin",
                  shortDescription: "Checks project files",
                  category: "developer-tools",
                },
                installed: false,
                enabled: false,
              },
            ],
          },
          {
            name: "remote",
            path: null,
            interface: { displayName: "Remote Catalog" },
            plugins: [
              {
                id: "remote-tool",
                name: "Remote Tool",
                interface: null,
                installed: false,
                enabled: false,
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    useCollaborationModes.mockReturnValue({
      data: { data: [{ name: "reviewer", model: "ruxex" }] },
      isLoading: false,
      isError: false,
    });
  });

  it("surfaces server-backed extensions and collaboration modes", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Plugins", level: 1 }),
    ).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("docs")).toBeNull();
    expect(screen.getByText(/official ·/)).toBeTruthy();
    expect(screen.getByText("Official Plugins")).toBeTruthy();
    expect(screen.getByText("Checks project files")).toBeTruthy();
    expect(screen.getByText(/developer-tools/)).toBeTruthy();
    expect(screen.getByText("Remote Catalog")).toBeTruthy();
    expect(
      screen.getByText("Remote marketplace plugins cannot be installed here."),
    ).toBeTruthy();
    expect(screen.getByText("reviewer")).toBeTruthy();
  });

  it("installs a local marketplace plugin and refreshes its marketplace", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Install Lint Plugin" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh Official Plugins" }),
    );

    expect(installPlugin.mutateAsync).toHaveBeenCalledWith({
      marketplacePath: "/tmp/official",
      pluginName: "lint",
    });
    expect(upgradeMarketplace.mutateAsync).toHaveBeenCalledWith({
      marketplaceName: "official",
    });
  });

  it("shows an empty state when the server returns no marketplaces", async () => {
    usePluginList.mockReturnValue({
      data: { marketplaces: [], marketplaceLoadErrors: [] },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No plugin marketplaces available.")).toBeTruthy();
  });

  it("switches the main content when the skills sidebar route is selected", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Skills", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText("review")).toBeTruthy();
    expect(screen.queryByText("official")).toBeNull();
    expect(screen.queryByText("docs")).toBeNull();
  });

  it("shows MCP servers only when the MCP sidebar route is selected", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=mcp"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "MCP", level: 1 })).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.queryByText("Official Plugins")).toBeNull();
  });

  it("reloads MCP configuration through the mutation hook", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=mcp"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload MCP" }));

    expect(reloadMcp.mutateAsync).toHaveBeenCalledWith({});
  });
});
