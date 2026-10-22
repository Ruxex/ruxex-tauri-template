// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCollaborationModes = vi.hoisted(() => vi.fn());
const useConfig = vi.hoisted(() => vi.fn());
const useConfigRequirements = vi.hoisted(() => vi.fn());
const useMcpServerStatus = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());
const useReloadMcpServers = vi.hoisted(() => vi.fn());
const useSkillsList = vi.hoisted(() => vi.fn());
const reloadMcp = vi.hoisted(() => ({
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
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
}));

describe("CapabilitiesPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    reloadMcp.mutateAsync.mockReset();
    reloadMcp.mutateAsync.mockResolvedValue({});
    useReloadMcpServers.mockReturnValue(reloadMcp);
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
        marketplaces: [{ name: "official", plugins: [{ id: "lint" }] }],
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
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("official")).toBeTruthy();
    expect(screen.getByText("reviewer")).toBeTruthy();
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
  });

  it("reloads MCP configuration through the mutation hook", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload MCP" }));

    expect(reloadMcp.mutateAsync).toHaveBeenCalledWith({});
  });
});
