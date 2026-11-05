// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
            localVersion: null,
            keywords: ["developer-tools"],
            interface: {
              displayName: "Example Plugin",
              shortDescription: "A short summary",
              longDescription: "A full plugin description.",
              developerName: "Example Dev",
              category: "developer-tools",
              capabilities: ["tools"],
              websiteUrl: "https://example.com/plugin",
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
          description:
            "The plugin read endpoint provides the canonical details.",
          skills: [
            {
              name: "review",
              description: "Reviews changes",
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

    expect(
      screen.getByRole("heading", { name: "Example Plugin", level: 1 }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The plugin read endpoint provides the canonical details.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("review")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
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
});
