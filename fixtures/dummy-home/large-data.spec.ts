import {
  LARGE_DATA_ADDITIONS,
  PAGE_DENSITY_COUNTS,
  PERSISTENT_SCENARIOS,
} from "./catalog";
import {
  archiveCurrentThread,
  closeSidebarPanel,
  createFixtureSchedule,
  createRootlessProject,
  openProjectChat,
  saveFixtureScreenshot,
  sendScenario,
  sendScenarioFromCurrentComposer,
  waitForDesktopReady,
} from "./support";

const FIRST_LARGE_OCCURRENCE = 3;
const FIRST_PROJECT_THREAD_OCCURRENCE =
  FIRST_LARGE_OCCURRENCE + LARGE_DATA_ADDITIONS.archivedThreads;

describe("Large page-density screenshots", () => {
  it("extends the ordinary home through the UI and captures crowded pages", async function () {
    this.timeout(9 * 60_000);
    await waitForDesktopReady();
    const basicScenario = PERSISTENT_SCENARIOS.find(
      (scenario) => scenario.id === "basic",
    );
    if (!basicScenario) {
      throw new Error("The basic DummyProvider scenario is missing");
    }

    await createLargeProjects();
    await createLargeThreadCatalog(basicScenario);
    await createLargeSchedules();
    await createLargeMcpServerList();

    await captureLargeHome();
    await captureLargeChats();
    await captureLargeProjects();
    await captureLargeProjectDetail();
    await captureLargeArchive();
    await captureLargeSchedules();
    await captureLargeMcpServers();
  });
});

async function captureLargeChats(): Promise<void> {
  await browser.url("tauri://localhost/#/chats");
  await $("h1=Chats").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.large.unassignedThreads,
    {
      timeout: 20_000,
      timeoutMsg: "The Unassigned tab should load every unassigned thread",
    },
  );
  await saveFixtureScreenshot("chats-unassigned-many-top.png");
  await $('main ul[aria-label="Chats"] > li:last-child').scrollIntoView({
    block: "center",
  });
  await saveFixtureScreenshot("chats-unassigned-many-bottom.png");

  await $("button=In projects").click();
  await browser.waitUntil(
    async () =>
      (await $$('main ul[aria-label="Chats"] > li').length) ===
      PAGE_DENSITY_COUNTS.large.projectAssignedThreads,
    {
      timeout: 20_000,
      timeoutMsg: "The In projects tab should load every assigned thread",
    },
  );
  await saveFixtureScreenshot("chats-projects-many-top.png");
  await $('main ul[aria-label="Chats"] > li:last-child').scrollIntoView({
    block: "center",
  });
  await saveFixtureScreenshot("chats-projects-many-bottom.png");
}

async function createLargeProjects(): Promise<void> {
  for (let index = 1; index <= LARGE_DATA_ADDITIONS.projects; index += 1) {
    await createRootlessProject({
      id: `large-project-${index}`,
      name: `Large project ${String(index).padStart(2, "0")}`,
      icon: "folder",
      color: "blue",
      roots: [],
      threadScenarioIds: [],
    });
  }
  await browser.url("tauri://localhost/#/projects");
  await waitForProjectCount(PAGE_DENSITY_COUNTS.large.projects);
}

async function createLargeThreadCatalog(
  basicScenario: (typeof PERSISTENT_SCENARIOS)[number],
): Promise<void> {
  const archivedEnd =
    FIRST_LARGE_OCCURRENCE + LARGE_DATA_ADDITIONS.archivedThreads;
  for (
    let occurrence = FIRST_LARGE_OCCURRENCE;
    occurrence < archivedEnd;
    occurrence += 1
  ) {
    await sendScenario(basicScenario, occurrence);
    await archiveCurrentThread();
  }

  for (
    let offset = 0;
    offset < LARGE_DATA_ADDITIONS.projectThreads;
    offset += 1
  ) {
    await openProjectChat("Product planning");
    await sendScenarioFromCurrentComposer(
      basicScenario,
      FIRST_PROJECT_THREAD_OCCURRENCE + offset,
    );
  }

  const activeStart =
    FIRST_PROJECT_THREAD_OCCURRENCE + LARGE_DATA_ADDITIONS.projectThreads;
  const activeEnd =
    activeStart +
    LARGE_DATA_ADDITIONS.activeThreads -
    LARGE_DATA_ADDITIONS.projectThreads;
  for (let occurrence = activeStart; occurrence < activeEnd; occurrence += 1) {
    await sendScenario(basicScenario, occurrence);
  }
}

async function createLargeSchedules(): Promise<void> {
  await browser.url("tauri://localhost/#/schedules");
  await $("h1=Automation").waitForDisplayed({ timeout: 10_000 });
  for (
    let index = 2;
    index <= PAGE_DENSITY_COUNTS.large.schedules;
    index += 1
  ) {
    await createFixtureSchedule(
      `Fixture schedule ${String(index).padStart(2, "0")}`,
    );
  }
}

async function createLargeMcpServerList(): Promise<void> {
  await browser.url("tauri://localhost/#/settings/mcp-servers");
  await $("h1=MCP servers").waitForDisplayed({ timeout: 10_000 });
  for (
    let index = 2;
    index <= PAGE_DENSITY_COUNTS.large.mcpServers;
    index += 1
  ) {
    const name = `fixture-mcp-${String(index).padStart(2, "0")}`;
    await $("button[aria-label='Add MCP server']").click();
    await $("h2=Add MCP server").waitForDisplayed({ timeout: 10_000 });
    await $("input[aria-label='Server name']").setValue(name);
    await $("select[aria-label='Transport']").selectByAttribute(
      "value",
      "streamableHttp",
    );
    await $("input[aria-label='URL']").setValue("http://127.0.0.1:3920/mcp");
    await $("dialog .modal-box button[aria-label='Add MCP server']").click();
    await $(
      `details[data-testid='mcp-server-details-${name}']`,
    ).waitForDisplayed({
      timeout: 10_000,
    });
  }
}

async function captureLargeHome(): Promise<void> {
  await browser.url("tauri://localhost/#/");
  await $(`[contenteditable='true'][aria-label='Message']`).waitForDisplayed({
    timeout: 10_000,
  });
  const openSidebar = $("button[aria-label='Open sidebar']");
  if (await openSidebar.isDisplayed().catch(() => false)) {
    await openSidebar.click();
  }
  await browser.waitUntil(
    async () => (await $$("#recent-chats-list > ul > li").length) === 8,
    {
      timeout: 10_000,
      timeoutMsg: "The large chat sidebar should fill its eight visible rows",
    },
  );
  await saveFixtureScreenshot("home-many.png");
}

async function captureLargeProjects(): Promise<void> {
  await browser.url("tauri://localhost/#/projects");
  await waitForProjectCount(PAGE_DENSITY_COUNTS.large.projects);
  await saveFixtureScreenshot("projects-many-top.png");
  await $("tr[aria-label='Open project Large project 21']").scrollIntoView({
    block: "center",
  });
  await saveFixtureScreenshot("projects-many-bottom.png");
}

async function captureLargeProjectDetail(): Promise<void> {
  await browser.url("tauri://localhost/#/projects");
  await waitForProjectCount(PAGE_DENSITY_COUNTS.large.projects);
  await $(
    "tr[aria-label='Open project Product planning'] td:first-child",
  ).click();
  await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => (await $$("section.card a").length) === 8,
    {
      timeout: 10_000,
      timeoutMsg: "The project detail should show its eight-thread page limit",
    },
  );
  await closeSidebarPanel();
  await saveFixtureScreenshot("project-detail-many.png");
}

async function captureLargeArchive(): Promise<void> {
  await browser.url("tauri://localhost/#/archive");
  await $("h1=Archived chats").waitForDisplayed({ timeout: 10_000 });
  await waitForArchivedCount(50);
  await saveFixtureScreenshot("archive-many-page-1.png");
  await $("button[aria-label='Next']").click();
  await $("span=Page 2").waitForDisplayed({ timeout: 10_000 });
  await waitForArchivedCount(PAGE_DENSITY_COUNTS.large.archivedThreads - 50);
  await saveFixtureScreenshot("archive-many-page-2.png");
}

async function captureLargeSchedules(): Promise<void> {
  await browser.url("tauri://localhost/#/schedules");
  await $("h1=Automation").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () =>
      (await $$('article[aria-label^="Open schedule:"]').length) ===
      PAGE_DENSITY_COUNTS.large.schedules,
    {
      timeout: 10_000,
      timeoutMsg: "The large Automation list should show all schedule cards",
    },
  );
  await saveFixtureScreenshot("automation-many-top.png");
  await $(
    `article[aria-label='Open schedule: Fixture schedule ${String(PAGE_DENSITY_COUNTS.large.schedules).padStart(2, "0")}']`,
  ).scrollIntoView({ block: "center" });
  await saveFixtureScreenshot("automation-many-bottom.png");
}

async function captureLargeMcpServers(): Promise<void> {
  await browser.url("tauri://localhost/#/settings/mcp-servers");
  await $("h1=MCP servers").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () =>
      (await $$('details[data-testid^="mcp-server-details-"]').length) ===
      PAGE_DENSITY_COUNTS.large.mcpServers,
    {
      timeout: 10_000,
      timeoutMsg: "The MCP settings page should show every configured server",
    },
  );
  await saveFixtureScreenshot("mcp-servers-many-top.png");
  await $(
    `details[data-testid='mcp-server-details-fixture-mcp-${String(PAGE_DENSITY_COUNTS.large.mcpServers).padStart(2, "0")}']`,
  ).scrollIntoView({ block: "center" });
  await saveFixtureScreenshot("mcp-servers-many-bottom.png");
}

async function waitForProjectCount(count: number): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await $$('table[aria-label="Projects"] tbody tr').length) === count,
    {
      timeout: 10_000,
      timeoutMsg: `Expected ${count} visible projects`,
    },
  );
}

async function waitForArchivedCount(count: number): Promise<void> {
  await browser.waitUntil(
    async () => (await $$('main a[href*="/chat/"]').length) === count,
    {
      timeout: 10_000,
      timeoutMsg: `Expected ${count} archived chat cards on the current page`,
    },
  );
}
