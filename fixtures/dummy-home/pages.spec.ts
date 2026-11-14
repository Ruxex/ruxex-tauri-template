import { PAGE_DENSITY_COUNTS } from "./catalog";
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
    heading: "[contenteditable='true'][aria-label='Message']",
    screenshotName: "home-ordinary.png",
  },
  {
    path: "/archive",
    heading: "h1=Archived chats",
    screenshotName: "archive-ordinary.png",
  },
  {
    path: "/chats",
    heading: "h1=Chats",
    screenshotName: "chats-ordinary.png",
  },
  {
    path: "/projects",
    heading: "h1=Projects",
    screenshotName: "projects-ordinary.png",
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
    path: "/settings/provider",
    heading: "h2=Provider",
    screenshotName: "settings-models.png",
  },
  {
    path: "/settings/app-server",
    heading: "h2.text-3xl",
    screenshotName: "settings-runtime.png",
  },
  {
    path: "/settings/hooks",
    heading: "h2=Hooks",
    screenshotName: "settings-hooks.png",
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
    heading: "h2=Account",
    screenshotName: "settings-account.png",
  },
  {
    path: "/settings/version",
    heading: "h2=Version",
    screenshotName: "settings-version.png",
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
  {
    path: "/activity",
    heading: "h1=Activity",
    screenshotName: "activity-center-empty.png",
  },
  {
    path: "/capabilities/plugins",
    heading: "h1=Plugins",
    screenshotName: "capabilities-plugins-no-marketplace.png",
  },
  {
    path: "/capabilities/skills",
    heading: "h1=Skills",
    screenshotName: "capabilities-skills-ordinary.png",
  },
  {
    path: "/capabilities/mcp",
    heading: "h1=MCP",
    screenshotName: "capabilities-mcp-no-servers.png",
  },
];

describe("DummyProvider page screenshots", () => {
  it("captures the unlisted pages from the prepared home", async () => {
    await waitForDesktopReady();

    for (const page of PAGE_FIXTURES) {
      await browser.url(`tauri://localhost/#${page.path}`);
      await $(page.heading).waitForDisplayed({ timeout: 10_000 });
      await waitForPageContent(page.path);
      if (page.path === "/archive") {
        await saveArchiveDialogScreenshots();
      }
      await saveFixtureScreenshot(page.screenshotName);
    }

    await captureChatTabs();
    await captureChatScopedSearch();
    await captureChatSearchOverflow();

    await browser.url("tauri://localhost/#/projects");
    await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
    await $(
      "tr[aria-label='Open project Product planning'] td:first-child",
    ).click();
    await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
    await closeSidebarPanel();
    await browser.waitUntil(
      async () =>
        (await $$("section.card a").length) >=
        PAGE_DENSITY_COUNTS.ordinary.projectThreads,
      {
        timeout: 10_000,
        timeoutMsg: "Ordinary project chats should be visible",
      },
    );
    await saveFixtureScreenshot("project-detail-ordinary.png");
    await saveProjectDialogScreenshots();
  });
});

async function captureChatTabs(): Promise<void> {
  await browser.url("tauri://localhost/#/chats");
  await $("h1=Chats").waitForDisplayed({ timeout: 10_000 });
  const selectedTab = $('button[role="tab"][aria-selected="true"]');
  await browser.waitUntil(
    async () => (await selectedTab.getText()) === "Unassigned",
    {
      timeout: 10_000,
      timeoutMsg: "Unassigned should be the default Chats tab",
    },
  );
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.ordinary.unassignedThreads,
    {
      timeout: 10_000,
      timeoutMsg: "The Unassigned tab should show only unassigned chats",
    },
  );

  await $("button=In projects").click();
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.ordinary.projectAssignedThreads,
    {
      timeout: 10_000,
      timeoutMsg: "The In projects tab should show only project chats",
    },
  );
  await saveFixtureScreenshot("chats-projects-ordinary.png");
}

async function captureChatScopedSearch(): Promise<void> {
  await browser.url("tauri://localhost/#/chats");
  await $("h1=Chats").waitForDisplayed({ timeout: 10_000 });
  await $("button=Unassigned").click();
  const search = $('section.workbench-main input[aria-label="Search chats"]');
  await search.setValue("Fixture");
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.ordinary.unassignedThreads,
    {
      timeout: 15_000,
      timeoutMsg: "Page search should stay scoped to Unassigned",
    },
  );
  await saveFixtureScreenshot("chats-search-unassigned-ordinary.png");

  await $("button=In projects").click();
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.ordinary.projectAssignedThreads,
    {
      timeout: 15_000,
      timeoutMsg: "Page search should follow the selected tab",
    },
  );
  await saveFixtureScreenshot("chats-search-projects-ordinary.png");
}

async function captureChatSearchOverflow(): Promise<void> {
  await browser.url("tauri://localhost/#/chats");
  await $("h1=Chats").waitForDisplayed({ timeout: 10_000 });
  const openSidebar = $("button[aria-label='Open sidebar']");
  if (await openSidebar.isDisplayed().catch(() => false)) {
    await openSidebar.click();
  }

  const sidebarSearch = $(
    'aside[aria-label="Chat sidebar"] input[aria-label="Search chats"]',
  );
  await sidebarSearch.waitForDisplayed({ timeout: 10_000 });
  await sidebarSearch.setValue("Fixture");
  const viewAll = $("a=View all results");
  await viewAll.waitForDisplayed({ timeout: 15_000 });
  await saveFixtureScreenshot("chats-sidebar-search-overflow.png");
  await viewAll.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes("scope=all"),
    {
      timeout: 10_000,
      timeoutMsg: "Sidebar search should open global Chats results",
    },
  );
  await browser.waitUntil(
    async () =>
      (await $(
        'section.workbench-main input[aria-label="Search chats"]',
      ).getValue()) === "Fixture",
    {
      timeout: 10_000,
      timeoutMsg: "The Chats page should restore the sidebar search term",
    },
  );
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.ordinary.activeThreads,
    {
      timeout: 15_000,
      timeoutMsg: "Global Chats results should include both tabs",
    },
  );
  await saveFixtureScreenshot("chats-search-ordinary.png");
}

async function waitForPageContent(path: string): Promise<void> {
  if (path === "/") {
    await waitForHomeReady();
    await browser.waitUntil(
      async () =>
        (await $$("#recent-chats-list > ul > li").length) ===
        Math.min(PAGE_DENSITY_COUNTS.ordinary.activeThreads, 8),
      {
        timeout: 10_000,
        timeoutMsg: "The ordinary chat sidebar should show its first page",
      },
    );
    return;
  }

  if (path === "/archive") {
    await browser.waitUntil(
      async () =>
        (await $$('main a[href*="/chat/"]').length) >= 2 ||
        (await $("main").getText()).includes("Unable to load archived chats."),
      {
        timeout: 10_000,
        timeoutMsg: "Ordinary archived chats should finish loading",
      },
    );
    return;
  }

  if (path === "/projects") {
    await browser.waitUntil(
      async () =>
        (await $$('table[aria-label="Projects"] tbody tr').length) ===
          PAGE_DENSITY_COUNTS.ordinary.projects ||
        (await $("main").getText()).includes("Unable to load projects."),
      {
        timeout: 10_000,
        timeoutMsg: "Ordinary projects should finish loading",
      },
    );
    return;
  }

  if (path === "/chats") {
    await browser.waitUntil(
      async () =>
        (await $$('main ul[aria-label="Chats"] > li').length) ===
          PAGE_DENSITY_COUNTS.ordinary.unassignedThreads ||
        (await $("main").getText()).includes("Unable to load chats"),
      {
        timeout: 15_000,
        timeoutMsg: "Ordinary active chats should finish loading",
      },
    );
    return;
  }

  const loadedStates: Record<string, () => Promise<boolean>> = {
    "/settings/provider": async () =>
      (await $("main").getText()).includes("Data directory"),
    "/settings/hooks": async () =>
      (await $("main").getText()).includes("No hooks configured.") ||
      (await $("main").getText()).includes("No hooks in this directory.") ||
      (await $("main").getText()).includes("Unable to load hooks") ||
      (await $$('button[aria-label^="PreToolUse"]').length) > 0,
    "/settings/marketplaces": async () => {
      const text = await $("main").getText();
      return (
        text.includes("No plugin marketplaces configured.") ||
        text.includes("Unable to load marketplaces:") ||
        (await $$(
          'button[aria-label^="Update "], button[aria-label^="Remove "]',
        ).length) > 0
      );
    },
    "/settings/mcp-servers": async () => {
      const text = await $("main").getText();
      return (
        text.includes("No global MCP servers configured.") ||
        text.includes("Unable to load global MCP servers:") ||
        text.includes("Unable to load MCP runtime status:") ||
        (await $$('details[data-testid^="mcp-server-details-"]').length) > 0
      );
    },
    "/settings/account": async () =>
      (await $("main").getText()).includes("Authenticated") ||
      (await $("button[aria-label='Log in']").isExisting()),
    "/schedules": async () => {
      const text = await $("main").getText();
      return (
        text.includes("No schedules yet") ||
        text.includes("Unable to load schedules:") ||
        (await $$('article[aria-label^="Open schedule:"]').length) > 0
      );
    },
    "/approvals": async () =>
      (await $("main").getText()).includes("No pending approvals.") ||
      (await $("main").getText()).includes("Approve once"),
    "/activity": async () =>
      (await $("main").getText()).includes("Fixture basic 01") ||
      (await $("main").getText()).includes("No activity yet.") ||
      (await $("[aria-label='Activity entries']").isExisting()),
    "/capabilities/plugins": async () =>
      (await $("main").getText()).includes("No plugin marketplaces yet") ||
      (await $("main").getText()).includes("Unable to load Plugins:") ||
      (await $$('[data-testid="plugin-marketplace"]').length) > 0,
    "/capabilities/skills": async () =>
      (await $$('[data-testid="skills-source-group"]').length) > 0 ||
      (await $("main").getText()).includes("No Skills discovered.") ||
      (await $("main").getText()).includes("Unable to load Skills:"),
    "/capabilities/mcp": async () =>
      (await $("main").getText()).includes("No MCP servers configured.") ||
      (await $$('[data-testid^="mcp-server-details-"]').length) > 0 ||
      (await $("main").getText()).includes("Unable to load MCP servers:"),
  };
  const isLoaded = loadedStates[path];
  if (isLoaded) {
    await browser.waitUntil(isLoaded, {
      timeout: 15_000,
      timeoutMsg: `The ${path} page data should finish loading`,
    });
  }
}

async function saveArchiveDialogScreenshots(): Promise<void> {
  await $$('button[aria-label="Delete"]')[0].click();
  await $("h2=Delete chat?").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("archive-delete-dialog.png");
  await $("button[aria-label='Cancel']").click();

  await $("button[aria-label='Delete all archived chats']").click();
  await $("h2=Delete all archived chats?").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("archive-delete-all-dialog.png");
  await $("button[aria-label='Cancel']").click();
}

async function saveProjectDialogScreenshots(): Promise<void> {
  await $("button[aria-label='Edit project']").click();
  await $("h2=Edit project").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("project-edit-dialog.png");
  await $(
    "dialog[aria-labelledby='edit-project-title'] .modal-box button[aria-label='Close edit project dialog']",
  ).click();

  await $("button[aria-label='Delete project']").click();
  await $("h2=Delete project?").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("project-delete-dialog.png");
  await $("button[aria-label='Cancel']").click();
}
