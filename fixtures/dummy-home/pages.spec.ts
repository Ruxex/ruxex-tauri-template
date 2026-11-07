import {
  closeSidebarPanel,
  saveFixtureScreenshot,
  waitForDesktopReady,
  waitForHomeReady,
} from "./support";

type PageFixture = {
  readonly path: string;
  readonly heading: string;
  readonly screenshotName: string;
};

const PAGE_FIXTURES: readonly PageFixture[] = [
  {
    path: "/",
    heading: "textarea[aria-label='Message']",
    screenshotName: "home-new-chat.png",
  },
  {
    path: "/threads",
    heading: "h1=Threads",
    screenshotName: "threads-list.png",
  },
  {
    path: "/archive",
    heading: "h1=Archived chats",
    screenshotName: "archived-chats.png",
  },
  {
    path: "/projects",
    heading: "h1=Projects",
    screenshotName: "projects-list.png",
  },
  {
    path: "/settings",
    heading: "h2=General",
    screenshotName: "settings-general.png",
  },
  {
    path: "/settings/appearance",
    heading: "h2=Appearance",
    screenshotName: "settings-appearance.png",
  },
  {
    path: "/settings/models",
    heading: "h2=Models",
    screenshotName: "settings-models.png",
  },
  {
    path: "/settings/app-server",
    heading: "h2.text-3xl",
    screenshotName: "settings-runtime.png",
  },
  {
    path: "/settings/archive",
    heading: "h1=Archived chats",
    screenshotName: "settings-archive.png",
  },
  {
    path: "/settings/marketplaces",
    heading: "h2=Plugin marketplaces",
    screenshotName: "settings-marketplaces.png",
  },
  {
    path: "/settings/mcp-servers",
    heading: "h1=MCP servers",
    screenshotName: "settings-mcp-servers.png",
  },
  {
    path: "/settings/account",
    heading: "h1=Account",
    screenshotName: "settings-account.png",
  },
  {
    path: "/schedules",
    heading: "h1=Automation",
    screenshotName: "automation-empty.png",
  },
  {
    path: "/approvals",
    heading: "h1=Approval center",
    screenshotName: "approval-center-empty.png",
  },
];

describe("DummyProvider page screenshots", () => {
  it("captures the unlisted pages from the prepared home", async () => {
    await waitForDesktopReady();

    for (const page of PAGE_FIXTURES) {
      await browser.url(`tauri://localhost/#${page.path}`);
      await $(page.heading).waitForDisplayed({ timeout: 10_000 });
      if (page.path === "/") {
        await waitForHomeReady();
      }
      await saveFixtureScreenshot(page.screenshotName);
    }

    await browser.url("tauri://localhost/#/projects");
    await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
    await $("a=Product planning").click();
    await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
    await closeSidebarPanel();
    await saveFixtureScreenshot("project-product-planning.png");
  });
});
