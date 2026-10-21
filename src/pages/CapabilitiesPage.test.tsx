// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCollaborationModes = vi.hoisted(() => vi.fn());
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

    render(<CapabilitiesPage />);

    expect(screen.getByRole("heading", { name: "Capabilities" })).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("review")).toBeTruthy();
    expect(screen.getByText("official")).toBeTruthy();
    expect(screen.getByText("reviewer")).toBeTruthy();
  });

  it("reloads MCP configuration through the mutation hook", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(<CapabilitiesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Reload MCP" }));

    expect(reloadMcp.mutateAsync).toHaveBeenCalledWith({});
  });
});
