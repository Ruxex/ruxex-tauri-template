// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useMcpServerStatus = vi.hoisted(() => vi.fn());
const useInstallPlugin = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());
const useReloadMcpServers = vi.hoisted(() => vi.fn());
const useSkillsList = vi.hoisted(() => vi.fn());
const useSetSkillsExtraRoots = vi.hoisted(() => vi.fn());
const useWriteSkillConfig = vi.hoisted(() => vi.fn());
const useUpgradeMarketplace = vi.hoisted(() => vi.fn());
const useMcpOauthLogin = vi.hoisted(() => vi.fn());
const useUninstallPlugin = vi.hoisted(() => vi.fn());
const openBrowserWindow = vi.hoisted(() => vi.fn());
const getDesktopUiPolicy = vi.hoisted(() => vi.fn());
const filterHiddenSkills = vi.hoisted(() =>
  vi.fn((skills: { name: string }[], hiddenSkills: ReadonlySet<string>) =>
    skills.filter((skill) => !hiddenSkills.has(skill.name)),
  ),
);
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
const oauthLogin = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
const writeSkillConfig = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  variables: undefined,
}));
const setSkillsExtraRoots = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
const uninstallPlugin = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock("../app-server/hooks", () => ({
  useMcpServerStatus,
  useInstallPlugin,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
  useSetSkillsExtraRoots,
  useWriteSkillConfig,
  useUpgradeMarketplace,
  useMcpOauthLogin,
  useUninstallPlugin,
}));

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("../platform/native", () => ({ openBrowserWindow }));
vi.mock("../platform/skill-policy", () => ({
  filterHiddenSkills,
  getDesktopUiPolicy,
}));

describe("CapabilitiesPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    openBrowserWindow.mockReset();
    open.mockReset();
    open.mockResolvedValue(null);
    getDesktopUiPolicy.mockReset();
    getDesktopUiPolicy.mockResolvedValue({ hiddenSkills: [] });
    oauthLogin.mutateAsync.mockReset();
    oauthLogin.mutateAsync.mockResolvedValue({
      authorizationUrl: "https://auth.example.test/start",
    });
    useMcpOauthLogin.mockReturnValue(oauthLogin);
    reloadMcp.mutateAsync.mockReset();
    reloadMcp.mutateAsync.mockResolvedValue({});
    useReloadMcpServers.mockReturnValue(reloadMcp);
    installPlugin.mutateAsync.mockReset();
    installPlugin.mutateAsync.mockResolvedValue({});
    useInstallPlugin.mockReturnValue(installPlugin);
    uninstallPlugin.mutateAsync.mockReset();
    uninstallPlugin.mutateAsync.mockResolvedValue({});
    useUninstallPlugin.mockReturnValue(uninstallPlugin);
    upgradeMarketplace.mutateAsync.mockReset();
    upgradeMarketplace.mutateAsync.mockResolvedValue({});
    useUpgradeMarketplace.mockReturnValue(upgradeMarketplace);
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
    writeSkillConfig.mutateAsync.mockReset();
    writeSkillConfig.mutateAsync.mockResolvedValue({ effectiveEnabled: true });
    useWriteSkillConfig.mockReturnValue(writeSkillConfig);
    setSkillsExtraRoots.mutateAsync.mockReset();
    setSkillsExtraRoots.mutateAsync.mockResolvedValue({});
    useSetSkillsExtraRoots.mockReturnValue(setSkillsExtraRoots);
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "official",
            path: "/tmp/official",
            interface: { displayName: "Official Plugins" },
            plugins: [
              {
                id: "lint@official",
                name: "lint",
                interface: {
                  displayName: "Lint Plugin",
                  shortDescription: "Checks project files",
                  category: "developer-tools",
                },
                installed: false,
                enabled: false,
              },
              {
                id: "calendar@official",
                name: "calendar",
                interface: {
                  displayName: "Calendar Plugin",
                  shortDescription: "Manages calendars",
                  category: "Productivity",
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
                id: "remote-tool@remote",
                name: "remote-tool",
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
  });

  it("disables canonical apps from plugin metadata", async () => {
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "openai-curated",
            path: "/tmp/openai-curated",
            interface: { displayName: "OpenAI Curated" },
            plugins: [
              {
                id: "lint@openai-curated",
                name: "lint",
                installPolicySource: "IMPLICIT_CANONICAL_APP",
                interface: {
                  displayName: "Lint Plugin",
                  shortDescription: "Checks project files",
                  category: "developer-tools",
                },
                installed: false,
                enabled: false,
              },
              {
                id: "calendar@openai-curated",
                name: "calendar",
                installPolicySource: null,
                interface: {
                  displayName: "Calendar Plugin",
                  shortDescription: "Manages calendars",
                  category: "Productivity",
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
                id: "remote-tool@remote",
                name: "remote-tool",
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
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    const { container } = render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("w-full");
    expect(container.firstElementChild?.className).toContain("max-w-5xl");
    expect(container.firstElementChild?.className).toContain("space-y-6");
    expect(
      screen.getByRole("heading", { name: "Plugins", level: 1 }),
    ).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("docs")).toBeNull();
    expect(screen.getByText(/openai-curated ·/)).toBeTruthy();
    expect(screen.getByText("OpenAI Curated")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "developer-tools", level: 3 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Productivity", level: 3 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Uncategorized", level: 3 }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("plugin-image-slot")).toHaveLength(3);
    await waitFor(() =>
      expect(
        screen.getAllByRole("img", { name: "Plugin image unavailable" }),
      ).toHaveLength(3),
    );
    expect(
      screen.queryByRole("heading", { name: "Plugins", level: 2 }),
    ).toBeNull();
    expect(document.getElementById("plugins")?.closest("article")).toBeNull();
    expect(screen.getAllByTestId("plugin-grid")[0].className).toContain(
      "lg:grid-cols-2",
    );
    expect(screen.getAllByTestId("plugin-marketplace")[0].className).toContain(
      "collapse",
    );
    expect(screen.getAllByTestId("plugin-marketplace")[0].className).toContain(
      "bg-base-100",
    );
    expect(screen.getByText("Checks project files")).toBeTruthy();
    expect(screen.getByText(/developer-tools/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "View details for Lint Plugin" })
        .getAttribute("href"),
    ).toBe("/capabilities/plugins/openai-curated/lint");
    expect(screen.queryAllByText("available")).toHaveLength(0);
    const officialInstallButton = screen.getByRole("button", {
      name: "Install Lint Plugin",
    });
    const officialInstallTooltip = officialInstallButton.closest(
      '[data-testid="official-app-install-tooltip"]',
    );
    expect((officialInstallButton as HTMLButtonElement).disabled).toBe(true);
    expect(officialInstallTooltip).not.toBeNull();
    expect(officialInstallTooltip?.getAttribute("title")).toBe(
      "Official Apps are not supported in Ruxex.",
    );
    expect(officialInstallButton.getAttribute("title")).toBe(
      "Official Apps are not supported in Ruxex.",
    );
    expect(officialInstallButton.className).toContain("opacity-50");
    fireEvent.click(officialInstallButton);
    expect(installPlugin.mutateAsync).not.toHaveBeenCalled();
    const pluginCardContent = screen.getAllByTestId("plugin-card-content")[0];
    expect(pluginCardContent.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)_auto]",
    );
    expect(pluginCardContent.children).toHaveLength(2);
    expect(screen.getByText("Checks project files").className).toContain(
      "break-words",
    );
    const supportedInstallButton = screen.getByRole("button", {
      name: "Install Calendar Plugin",
    });
    expect((supportedInstallButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Remote Catalog")).toBeTruthy();
    expect(
      screen.getByText("Remote marketplace plugins cannot be installed here."),
    ).toBeTruthy();
    expect(screen.queryByText("reviewer")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Configure OpenAI Curated" })
        .getAttribute("href"),
    ).toBe("/settings/marketplaces");
  });

  it("installs a local marketplace plugin and refreshes its marketplace", async () => {
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [
              {
                id: "format@community",
                name: "format",
                interface: {
                  displayName: "Format Plugin",
                  shortDescription: "Formats project files",
                  category: "developer-tools",
                },
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
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    const installButton = screen.getByRole("button", {
      name: "Install Format Plugin",
    });
    expect(installButton.className).toContain("btn-outline");
    expect(installButton.textContent).not.toContain("Format Plugin");
    fireEvent.click(installButton);
    const refreshButton = screen.getByRole("button", {
      name: "Refresh Community Plugins",
    });
    expect(refreshButton.className).toContain("btn-square");
    expect(refreshButton.closest(".collapse-content")).not.toBeNull();
    expect(
      refreshButton.closest('[data-testid="plugin-marketplace"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Configure Community Plugins" })
        .getAttribute("href"),
    ).toBe("/settings/marketplaces");
    fireEvent.click(refreshButton);

    expect(installPlugin.mutateAsync).toHaveBeenCalledWith({
      marketplacePath: "/tmp/community",
      pluginName: "format",
    });
    expect(upgradeMarketplace.mutateAsync).toHaveBeenCalledWith({
      marketplaceName: "community",
    });
  });

  it("uninstalls an installed plugin by its plugin id", async () => {
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [
              {
                id: "format@community",
                name: "format",
                interface: {
                  displayName: "Format Plugin",
                  shortDescription: "Formats project files",
                  category: "developer-tools",
                },
                installed: true,
                enabled: true,
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Installed")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Uninstall Format Plugin" }),
    );

    expect(uninstallPlugin.mutateAsync).toHaveBeenCalledWith({
      pluginId: "format@community",
    });
  });

  it("does not uninstall a plugin when confirmation is canceled", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [
              {
                id: "format@community",
                name: "format",
                interface: { displayName: "Format Plugin", category: "tools" },
                installed: true,
                enabled: true,
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Uninstall Format Plugin" }),
    );

    expect(uninstallPlugin.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps official installed plugins unavailable for uninstall", async () => {
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "official",
            path: "/tmp/official",
            interface: { displayName: "Official Plugins" },
            plugins: [
              {
                id: "lint@official",
                name: "lint",
                installPolicySource: "IMPLICIT_CANONICAL_APP",
                interface: { displayName: "Lint Plugin", category: "tools" },
                installed: true,
                enabled: true,
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Uninstall Lint Plugin" }),
    ).toBeNull();
  });

  it("shows the uninstall error and disables the action while pending", async () => {
    useUninstallPlugin.mockReturnValueOnce({
      ...uninstallPlugin,
      isPending: true,
      isError: true,
      error: new Error("Plugin is in use"),
    });
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [
              {
                id: "format@community",
                name: "format",
                interface: { displayName: "Format Plugin", category: "tools" },
                installed: true,
                enabled: true,
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", {
      name: "Uninstall Format Plugin",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain("Unable to uninstall plugin");
    expect(document.body.textContent).toContain("Error: Plugin is in use");
  });

  it("keeps remote-only official plugins without an install button", async () => {
    usePluginList.mockReturnValueOnce({
      data: {
        marketplaces: [
          {
            name: "official",
            path: null,
            interface: { displayName: "Official Remote Plugins" },
            plugins: [
              {
                id: "remote-tool@official",
                name: "remote-tool",
                interface: {
                  displayName: "Remote Tool",
                  shortDescription: "A remote-only official plugin",
                  category: "developer-tools",
                },
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
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Install Remote Tool" }),
    ).toBeNull();
    expect(
      screen.getByText("Remote marketplace plugins cannot be installed here."),
    ).toBeTruthy();
  });

  it("collapses marketplaces and plugin categories independently", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    const marketplaces = screen.getAllByTestId("plugin-marketplace");
    expect(marketplaces).toHaveLength(2);
    const officialToggle = within(marketplaces[0]).getByRole("checkbox", {
      name: "Official Plugins",
    }) as HTMLInputElement;
    const remoteToggle = within(marketplaces[1]).getByRole("checkbox", {
      name: "Remote Catalog",
    }) as HTMLInputElement;
    expect(officialToggle.checked).toBe(true);
    expect(remoteToggle.checked).toBe(true);

    const productivityCategory = screen
      .getByRole("heading", { name: "Productivity", level: 3 })
      .closest('[data-testid="plugin-category"]');
    expect(productivityCategory).not.toBeNull();
    const productivityToggle = within(
      productivityCategory as HTMLElement,
    ).getByRole("checkbox", { name: "Productivity" }) as HTMLInputElement;
    expect(productivityToggle.checked).toBe(true);
    fireEvent.click(productivityToggle);
    expect(productivityToggle.checked).toBe(false);
    expect(officialToggle.checked).toBe(true);

    fireEvent.click(officialToggle);
    expect(officialToggle.checked).toBe(false);
    expect(remoteToggle.checked).toBe(true);
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

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "No plugin marketplaces yet",
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/No plugin marketplaces available\./)).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Add plugin marketplace" })
        .getAttribute("href"),
    ).toBe("/settings/marketplaces");
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

  it("renders Skills with enabled state and writes by path", async () => {
    const reviewPath = "/workspace/.agents/skills/review";
    const deployPath = "/workspace/.agents/skills/deploy";
    const defaultPath = "/home/minato/.ruxex_desktop/skills/default-review";
    const longDescription =
      "This is a deliberately long description that should be shortened in the skill list while remaining available as a tooltip.";
    const mutateAsync = vi.fn().mockResolvedValue({ effectiveEnabled: false });
    useSkillsList.mockReturnValue({
      data: {
        data: [
          {
            cwd: "/home/minato/.ruxex_desktop/skills",
            skills: [
              {
                name: "default-review",
                description: "Default long description",
                shortDescription: "Built-in review skill",
                path: defaultPath,
                scope: "system",
                enabled: true,
                pluginId: null,
              },
            ],
            errors: [],
          },
          {
            cwd: "/workspace/.agents/skills",
            skills: [
              {
                name: "review",
                description: longDescription,
                path: reviewPath,
                scope: "user",
                enabled: true,
                pluginId: null,
              },
              {
                name: "deploy",
                description: "Deploy the project",
                path: deployPath,
                scope: "workspace",
                enabled: false,
                pluginId: "deploy@community",
              },
            ],
            errors: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useWriteSkillConfig.mockReturnValue({
      ...writeSkillConfig,
      mutateAsync,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    const reviewToggle = screen.getByRole("switch", { name: "Enable review" });
    const deployToggle = screen.getByRole("switch", { name: "Enable deploy" });
    expect((reviewToggle as HTMLInputElement).checked).toBe(true);
    expect((deployToggle as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.queryByText("/home/minato/.ruxex_desktop/skills")).toBeNull();
    expect(screen.getByText("/workspace/.agents/skills")).toBeTruthy();
    expect(screen.getByText("Built-in review skill")).toBeTruthy();
    expect(screen.queryByText("Default long description")).toBeNull();
    const fallbackDescription = screen.getByText(longDescription);
    expect(fallbackDescription.className).toContain("line-clamp-2");
    expect(fallbackDescription.getAttribute("title")).toBe(longDescription);
    expect(reviewToggle.className).toContain("toggle");
    expect(reviewToggle.className).toContain("toggle-primary");
    expect(reviewToggle.parentElement?.parentElement?.className).toContain(
      "items-center",
    );
    expect(screen.getAllByTestId("skills-source-group")).toHaveLength(2);
    fireEvent.click(reviewToggle);

    expect(mutateAsync).toHaveBeenCalledWith({
      path: reviewPath,
      enabled: false,
    });
  });

  it("gives the Skills content the full page width", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    const skillsCard = screen
      .getByRole("heading", { name: "Skills", level: 2 })
      .closest("article");
    expect(skillsCard?.className).toContain("w-full");
    expect(skillsCard?.parentElement?.className).not.toContain(
      "lg:grid-cols-2",
    );
  });

  it("adds a native directory to the Skill extra roots", async () => {
    open.mockResolvedValueOnce("/tmp/shared-skills");
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Skill directory" }),
    );

    await waitFor(() =>
      expect(setSkillsExtraRoots.mutateAsync).toHaveBeenCalledWith({
        extraRoots: ["/tmp/shared-skills"],
      }),
    );
    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Select Skill directory",
    });
    expect(screen.getByText("/tmp/shared-skills")).toBeTruthy();

    open.mockResolvedValueOnce("/workspace/team-skills");
    fireEvent.click(
      screen.getByRole("button", { name: "Add Skill directory" }),
    );
    await waitFor(() =>
      expect(setSkillsExtraRoots.mutateAsync).toHaveBeenLastCalledWith({
        extraRoots: ["/tmp/shared-skills", "/workspace/team-skills"],
      }),
    );
  });

  it("limits Skill pending state to the affected path", async () => {
    const reviewPath = "/workspace/.agents/skills/review";
    useSkillsList.mockReturnValue({
      data: {
        data: [
          {
            cwd: "/workspace",
            skills: [
              {
                name: "review",
                path: reviewPath,
                enabled: true,
                pluginId: null,
              },
              {
                name: "deploy",
                path: "/workspace/.agents/skills/deploy",
                enabled: false,
                pluginId: null,
              },
            ],
            errors: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useWriteSkillConfig.mockReturnValue({
      ...writeSkillConfig,
      isPending: true,
      variables: { path: reviewPath, enabled: false },
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(
      (
        screen.getByRole("switch", {
          name: "Enable review",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("switch", {
          name: "Enable deploy",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it("hides product-disabled Skills and empty source groups from the UI", async () => {
    getDesktopUiPolicy.mockResolvedValue({ hiddenSkills: ["imagegen"] });
    useSkillsList.mockReturnValue({
      data: {
        data: [
          {
            cwd: "/workspace",
            skills: [
              {
                name: "imagegen",
                path: "/workspace/.agents/skills/imagegen",
                enabled: false,
                pluginId: null,
              },
              {
                name: "review",
                path: "/workspace/.agents/skills/review",
                enabled: true,
                pluginId: null,
              },
            ],
            errors: [],
          },
          {
            cwd: "/workspace/hidden",
            skills: [
              {
                name: "imagegen",
                path: "/workspace/hidden/.agents/skills/imagegen",
                enabled: false,
                pluginId: null,
              },
            ],
            errors: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("imagegen")).toBeNull();
      expect(screen.getByText("review")).toBeTruthy();
      expect(screen.getAllByTestId("skills-source-group")).toHaveLength(1);
    });
    expect(getDesktopUiPolicy).toHaveBeenCalledTimes(1);
  });

  it("keeps the server state after a failed Skill update", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("Skill config rejected"));
    useSkillsList.mockReturnValue({
      data: {
        data: [
          {
            cwd: "/workspace",
            skills: [
              {
                name: "review",
                path: "/workspace/.agents/skills/review",
                enabled: true,
                pluginId: null,
              },
            ],
            errors: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useWriteSkillConfig.mockReturnValue({
      ...writeSkillConfig,
      mutateAsync,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=skills"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );
    const reviewToggle = screen.getByRole("switch", { name: "Enable review" });
    fireEvent.click(reviewToggle);

    await waitFor(() =>
      expect(document.body.textContent).toContain("Skill config rejected"),
    );
    expect((reviewToggle as HTMLInputElement).checked).toBe(true);
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
    const serverDetails = screen.getByTestId("mcp-server-details-docs");
    expect(serverDetails.tagName).toBe("DETAILS");
    expect(serverDetails.getAttribute("open")).toBeNull();
    expect(serverDetails.className).toContain("collapse");
    expect(serverDetails.className).toContain("collapse-arrow");
    expect(serverDetails.querySelector("summary")?.className).toContain(
      "collapse-title",
    );
    expect(serverDetails.querySelector(".collapse-content")).not.toBeNull();
    expect(within(serverDetails).getByText("1 tools")).toBeTruthy();
    expect(screen.queryByText("Official Plugins")).toBeNull();
    expect(screen.queryByText("Collaboration modes")).toBeNull();
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

  it("connects an unauthenticated MCP server through the OS browser", async () => {
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=mcp"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect docs" }));

    await waitFor(() =>
      expect(oauthLogin.mutateAsync).toHaveBeenCalledWith({ name: "docs" }),
    );
    expect(openBrowserWindow).toHaveBeenCalledWith(
      "https://auth.example.test/start",
    );
  });

  it("rejects an invalid OAuth authorization URL", async () => {
    oauthLogin.mutateAsync.mockResolvedValueOnce({
      authorizationUrl: "javascript:alert(1)",
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=mcp"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect docs" }));

    expect(
      await screen.findByText("OAuth authorization URL is invalid."),
    ).toBeTruthy();
    expect(openBrowserWindow).not.toHaveBeenCalled();
  });

  it("labels OAuth, bearer-token, and unknown auth states distinctly", async () => {
    useMcpServerStatus.mockReturnValue({
      data: {
        data: [
          {
            name: "oauth-docs",
            runtimeStatus: "connected",
            tools: {},
            authStatus: "oAuth",
            toolsError: null,
          },
          {
            name: "token-docs",
            runtimeStatus: "connected",
            tools: {},
            authStatus: "bearerToken",
            toolsError: null,
          },
          {
            name: "unknown-docs",
            runtimeStatus: null,
            tools: {},
            authStatus: "unknown",
            toolsError: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    const { CapabilitiesPage } = await import("./CapabilitiesPage");

    render(
      <MemoryRouter initialEntries={["/capabilities?tab=mcp"]}>
        <CapabilitiesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("OAuth connected")).toBeTruthy();
    expect(screen.getByText("Bearer token configured")).toBeTruthy();
    expect(screen.getByText("Authentication status unavailable")).toBeTruthy();
  });
});
