// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const usePluginList = vi.hoisted(() => vi.fn());
const usePluginRead = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ usePluginList, usePluginRead }));

describe("PluginDetailPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "community",
            path: "/tmp/community",
            interface: { displayName: "Community Plugins" },
            plugins: [
              {
                id: "example@community",
                name: "example",
                source: { type: "git", url: "https://example.com/plugin" },
                installed: false,
                enabled: false,
                installPolicy: "AVAILABLE",
                installPolicySource: null,
                mustShowInstallationInterstitial: null,
                authPolicy: "ON_INSTALL",
                availability: "AVAILABLE",
                keywords: ["developer-tools"],
                interface: {
                  displayName: "Example Plugin",
                  shortDescription: "A short summary",
                  longDescription: "A full plugin description.",
                  developerName: "Example Dev",
                  category: "developer-tools",
                  capabilities: ["tools"],
                  websiteUrl: "https://example.com/plugin",
                  privacyPolicyUrl: "https://example.com/privacy",
                  termsOfServiceUrl: "https://example.com/terms",
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
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    usePluginRead.mockReturnValue({
      data: {
        plugin: {
          marketplaceName: "community",
          marketplacePath: "/tmp/community",
          summary: {
            name: "example",
            id: "example@community",
            source: { type: "git", url: "https://example.com/plugin" },
            installed: false,
            enabled: false,
            installPolicy: "AVAILABLE",
            installPolicySource: null,
            mustShowInstallationInterstitial: null,
            authPolicy: "ON_INSTALL",
            availability: "AVAILABLE",
            localVersion: "1.2.3",
            keywords: ["developer-tools"],
            interface: {
              displayName: "Example Plugin",
              shortDescription: "A short summary",
              longDescription: "A full plugin description.",
              developerName: "Example Dev",
              category: "developer-tools",
              capabilities: ["tools"],
              websiteUrl: "https://example.com/plugin",
              privacyPolicyUrl: "https://example.com/privacy",
              termsOfServiceUrl: "https://example.com/terms",
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
          },
          description:
            "The plugin read endpoint provides the canonical details.",
          skills: [
            {
              name: "review",
              description: "Reviews changes",
              shortDescription: "Review changes quickly",
              interface: {
                shortDescription: "Interface short description",
                iconSmallUrl: null,
                iconLargeUrl: null,
              },
              path: null,
              enabled: true,
            },
            {
              name: "deploy",
              description: "Detailed deployment instructions",
              shortDescription: null,
              interface: null,
              path: null,
              enabled: true,
            },
          ],
          onboardingSkill: null,
          hooks: [{ key: "on-save", eventName: "after_tool_call" }],
          mcpServers: ["docs"],
          scheduledTasks: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("loads and renders local plugin details", async () => {
    const { PluginDetailPage } = await import("./PluginDetailPage");

    const { container } = render(
      <MemoryRouter
        initialEntries={["/capabilities/plugins/community/example"]}
      >
        <Routes>
          <Route
            path="/capabilities/plugins/:marketplaceName/:pluginName"
            element={<PluginDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("min-w-[640px]");
    expect(
      screen.getByRole("heading", { name: "Example Plugin", level: 1 }),
    ).toBeTruthy();
    const header = screen.getByRole("banner");
    const byline = within(header).getByText("by Example Dev");
    const description = within(header).getByText(
      "The plugin read endpoint provides the canonical details.",
    );
    expect(byline.parentElement).toBe(description.parentElement);
    const skillButton = screen.getByRole("button", {
      name: /review.*Interface short description/,
    });
    expect(skillButton).toBeTruthy();
    expect(skillButton.className).toContain("w-full");
    expect(screen.getByText("Interface short description")).toBeTruthy();
    expect(screen.queryByText("Review changes quickly")).toBeNull();
    expect(screen.queryByText("Reviews changes")).toBeNull();
    expect(screen.getByText("deploy")).toBeTruthy();
    expect(screen.queryByText("Detailed deployment instructions")).toBeNull();
    fireEvent.click(skillButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Reviews changes")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Close skill details" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Information", level: 2 }),
    ).toBeTruthy();
    expect(screen.getByText("tools")).toBeTruthy();
    expect(screen.getByText("developer-tools")).toBeTruthy();
    expect(screen.getByText("1.2.3")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "https://example.com/plugin" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "https://example.com/privacy" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "https://example.com/terms" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open website" }).getAttribute("href"),
    ).toBe("https://example.com/plugin");
    expect(usePluginRead).toHaveBeenCalledWith({
      marketplacePath: "/tmp/community",
      pluginName: "example",
    });
  });

  it("renders list metadata for remote-only plugins", async () => {
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "openai-curated",
            path: null,
            interface: { displayName: "OpenAI Curated" },
            plugins: [
              {
                id: "calendar@openai-curated",
                name: "calendar",
                source: { type: "git", url: "https://example.com/calendar" },
                installed: false,
                enabled: false,
                installPolicy: "AVAILABLE",
                installPolicySource: "IMPLICIT_CANONICAL_APP",
                mustShowInstallationInterstitial: null,
                authPolicy: "ON_INSTALL",
                availability: "AVAILABLE",
                keywords: [],
                interface: {
                  displayName: "Calendar",
                  shortDescription: "Calendar summary",
                  longDescription: "Calendar details from the catalog.",
                  developerName: "OpenAI",
                  category: "Productivity",
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
              },
            ],
          },
        ],
        marketplaceLoadErrors: [],
      },
      isLoading: false,
      isError: false,
    });
    usePluginRead.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
    const { PluginDetailPage } = await import("./PluginDetailPage");

    render(
      <MemoryRouter
        initialEntries={["/capabilities/plugins/openai-curated/calendar"]}
      >
        <Routes>
          <Route
            path="/capabilities/plugins/:marketplaceName/:pluginName"
            element={<PluginDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Calendar", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText("Calendar details from the catalog.")).toBeTruthy();
    expect(
      screen.getByText(
        "Detailed plugin metadata is unavailable for remote-only marketplaces.",
      ),
    ).toBeTruthy();
    expect(usePluginRead).toHaveBeenCalledWith(null);
  });

  it("lets a plugin with only skills use the full detail width", async () => {
    usePluginRead.mockReturnValueOnce({
      data: {
        plugin: {
          marketplaceName: "community",
          marketplacePath: "/tmp/community",
          summary: {
            name: "example",
            id: "example@community",
            source: { type: "git", url: "https://example.com/plugin" },
            localVersion: "1.2.3",
            interface: {
              displayName: "Example Plugin",
              capabilities: [],
              developerName: "Example Dev",
              category: "tools",
              websiteUrl: null,
              privacyPolicyUrl: null,
              termsOfServiceUrl: null,
            },
          },
          description: "A plugin with skills only.",
          skills: [
            {
              name: "review",
              description: "Reviews changes",
              shortDescription: "Review changes quickly",
              interface: null,
              path: null,
              enabled: true,
            },
          ],
          hooks: [],
          mcpServers: [],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    const { PluginDetailPage } = await import("./PluginDetailPage");

    render(
      <MemoryRouter
        initialEntries={["/capabilities/plugins/community/example"]}
      >
        <Routes>
          <Route
            path="/capabilities/plugins/:marketplaceName/:pluginName"
            element={<PluginDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const skillsSection = screen
      .getByRole("heading", { name: "Skills", level: 2 })
      .closest("section");
    expect(skillsSection?.parentElement?.className).not.toContain(
      "lg:grid-cols-3",
    );
  });
});
