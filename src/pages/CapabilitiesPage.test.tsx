// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilitiesPage } from "./CapabilitiesPage";

const useInstallPlugin = vi.hoisted(() => vi.fn());
const useMcpOauthLogin = vi.hoisted(() => vi.fn());
const useMcpServerStatus = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());
const useReloadMcpServers = vi.hoisted(() => vi.fn());
const useSkillsList = vi.hoisted(() => vi.fn());
const useUninstallPlugin = vi.hoisted(() => vi.fn());
const useUpgradeMarketplace = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useInstallPlugin,
  useMcpOauthLogin,
  useMcpServerStatus,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
  useUninstallPlugin,
  useUpgradeMarketplace,
}));

const uninstall = vi.hoisted(() => vi.fn());

function plugin(overrides: Record<string, unknown> = {}) {
  return {
    id: "example@community",
    localVersion: null,
    name: "example",
    source: { type: "git", url: "https://example.com/example.git", path: null, refName: "main", sha: null },
    installed: true,
    enabled: true,
    installPolicy: "AVAILABLE",
    installPolicySource: "WORKSPACE_SETTING",
    mustShowInstallationInterstitial: null,
    authPolicy: "OAUTH",
    availability: "AVAILABLE",
    interface: {
      displayName: "Example Plugin",
      shortDescription: "Example plugin",
      longDescription: null,
      developerName: null,
      category: "Tools",
      capabilities: [],
      websiteUrl: null,
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      defaultPrompt: null,
      brandColor: null,
      composerIcon: null,
      composerIconUrl: null,
      logo: null,
      logoDark: null,
      logoUrl: null,
      logoUrlDark: null,
      screenshots: [],
      screenshotUrls: [],
    },
    keywords: [],
    ...overrides,
  };
}

function pluginList() {
  return {
    data: {
      marketplaces: [
        {
          name: "community",
          path: "/tmp/community",
          interface: { displayName: "Community", developerName: null, websiteUrl: null },
          plugins: [plugin(), plugin({
            id: "official@community",
            name: "official",
            installed: false,
            enabled: false,
            installPolicySource: "IMPLICIT_CANONICAL_APP",
            interface: { ...plugin().interface, displayName: "Official App" },
          })],
        },
      ],
      marketplaceLoadErrors: [],
    },
    isLoading: false,
    isError: false,
    error: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CapabilitiesPage />
    </MemoryRouter>,
  );
}

describe("CapabilitiesPage", () => {
  beforeEach(() => {
    usePluginList.mockReset().mockReturnValue(pluginList());
    useInstallPlugin.mockReset().mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useUninstallPlugin.mockReset().mockReturnValue({
      mutateAsync: uninstall,
      isPending: false,
      isError: false,
      error: null,
    });
    useMcpServerStatus.mockReset().mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    useSkillsList.mockReset().mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    useReloadMcpServers.mockReset().mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useUpgradeMarketplace.mockReset().mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useMcpOauthLogin.mockReset().mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    uninstall.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows uninstall for an installed non-official plugin", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: "Uninstall Example Plugin" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Install Official App",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("uninstalls the selected plugin after confirmation", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Uninstall Example Plugin" }),
    );

    expect(uninstall).toHaveBeenCalledWith({ pluginId: "example@community" });
  });

  it("does not uninstall when confirmation is canceled", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Uninstall Example Plugin" }),
    );

    expect(uninstall).not.toHaveBeenCalled();
  });

  it("disables uninstall while pending and shows an error after failure", () => {
    useUninstallPlugin.mockReturnValue({
      mutateAsync: uninstall,
      isPending: true,
      isError: true,
      error: new Error("Plugin is in use"),
    });
    renderPage();

    expect(useUninstallPlugin).toHaveBeenCalled();
    expect(useUninstallPlugin.mock.results[0]?.value.isError).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Uninstall Example Plugin",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(document.body.textContent).toContain("Unable to uninstall plugin");
    expect(document.body.textContent).toContain("Error: Plugin is in use");
  });
});
