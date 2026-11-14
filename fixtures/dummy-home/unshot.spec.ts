import path from "node:path";

import {
  buildScenarioTitle,
  PAGE_DENSITY_COUNTS,
  PERSISTENT_SCENARIOS,
} from "./catalog";
import {
  closeSidebarPanel,
  saveFixtureScreenshot,
  sendComposerPrompt,
  waitForDesktopReady,
  waitForCompletedTurn,
  withWindowSize,
} from "./support";

async function openRoute(path: string, selector: string): Promise<void> {
  await browser.url(`tauri://localhost/#${path}`);
  await $(selector).waitForDisplayed({ timeout: 10_000 });
}

async function openFixtureThread(): Promise<void> {
  await openRoute("/projects", "h1=Projects");
  await $(
    "tr[aria-label='Open project Product planning'] td:first-child",
  ).click();
  await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
  const projectChats = $("section.card").$$("a");
  await projectChats[0].waitForDisplayed({ timeout: 10_000 });
  await projectChats[0].click();
  await $(`[aria-label='Chat activity']`).waitForDisplayed({ timeout: 10_000 });
}

describe("DummyProvider unshot UI screenshots", () => {
  it("captures the remaining page and interactive component states", async () => {
    await waitForDesktopReady();

    await captureAccountStates();

    await captureThemePresetPopover();

    await openRoute("/quick-panel", "h1=Quick request");
    await saveFixtureScreenshot("quick-panel.png");

    await openFixtureThread();
    await saveFixtureScreenshot("chat-completed-basic.png");
    await captureExampleProviderThreads();
    await captureThreadSummary();
    await captureVisualizeFrame();

    await captureComposerStates();
    await captureChatSearch();
    await captureProjectDialogs();
    await captureAutomationStates();
    await captureMcpDialogs();

    await closeSidebarPanel();
  });
});

async function captureExampleProviderThreads(): Promise<void> {
  const scenarioIds = [
    "plan",
    "reasoning",
    "markdown",
    "subagent",
    "parallel-subagents",
  ] as const;

  for (const scenarioId of scenarioIds) {
    const scenario = PERSISTENT_SCENARIOS.find(
      (candidate) => candidate.id === scenarioId,
    );
    if (!scenario) {
      throw new Error(`Missing Example provider fixture: ${scenarioId}`);
    }

    await browser.url("tauri://localhost/#/chats");
    await $("h1=Chats").waitForDisplayed({ timeout: 10_000 });
    const title = buildScenarioTitle(scenario, 1);
    const chat = $(
      `//main//ul[@aria-label="Chats"]//a[contains(., "${title}")]`,
    );
    await chat.waitForDisplayed({ timeout: 10_000 });
    await chat.click();
    await $("[aria-label='Chat activity']").waitForDisplayed({
      timeout: 10_000,
    });
    await saveFixtureScreenshot(`chat-example-${scenarioId}.png`);
  }
}

async function captureThemePresetPopover(): Promise<void> {
  await openRoute("/settings/appearance", "h2=Appearance");
  const settingsSidebar = $("aside[aria-label='Settings sidebar']");
  if (!(await settingsSidebar.isDisplayed().catch(() => false))) {
    await $("button[aria-label='Open sidebar']").click();
  }
  await $("aside[aria-label='Settings sidebar']").waitForDisplayed({
    timeout: 10_000,
  });
  const selector = $("details[data-testid='theme-preset-selector']");
  await selector.$("summary").click();
  await selector
    .$("fieldset[aria-label='Theme preset options']")
    .waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("theme-preset-popover-sidebar.png");
  await selector.$("summary").click();
}

async function captureAccountStates(): Promise<void> {
  await openRoute("/settings/account", "h2=Account");
  await $$("button[aria-label='Log out']")[0].waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("settings-account-ordinary.png");

  await $("button[aria-label='Log out']").click();
  await $("button[aria-label='Log in']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("settings-account-login.png");

  await $("input[aria-label='API key']").setValue("ruxex-e2e-dummy");
  await $("button[aria-label='Log in']").click();
  await browser.waitUntil(
    async () => (await $("main").getText()).includes("Authenticated"),
    {
      timeout: 10_000,
      timeoutMsg: "The dummy account should be authenticated again",
    },
  );
}

async function captureThreadSummary(): Promise<void> {
  await withWindowSize(1920, 800, async () => {
    await $("[data-testid='thread-summary-panel']").waitForDisplayed({
      timeout: 10_000,
    });
    await saveFixtureScreenshot("thread-summary.png");
  });
}

async function captureVisualizeFrame(): Promise<void> {
  const visualizationPath = path.resolve(
    "fixtures/dummy-home/visualization.html",
  );
  const reference = `visualize${JSON.stringify({ path: visualizationPath })}`;
  await sendComposerPrompt(
    `Render this local visualization ${reference} example:basic`,
  );
  await waitForCompletedTurn({
    kind: "text",
    value: "This is a fixed response from the dummy provider.",
  });
  await $$('iframe[title="Visualization"]')[0].waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("visualize-frame.png");
}

async function captureComposerStates(): Promise<void> {
  const composer = $("[contenteditable='true'][aria-label='Message']");
  await composer.waitForDisplayed({ timeout: 10_000 });

  await $("summary[aria-label='Composer options']").click();
  await $("button[aria-label='Goal mode']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("composer-options.png");
  await $("button[aria-label='Goal mode']").click();
  await $("[role='status'][aria-label='Goal mode active']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("composer-goal-mode.png");
  await $("button[aria-label='Disable goal mode']").click();
  await $("summary[aria-label='Composer options']").click();

  await $("summary[aria-label='Permission mode']").click();
  await $("button[aria-label='Read-only']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("composer-permission-menu.png");
  await $("summary[aria-label='Permission mode']").click();

  await $("summary[aria-label='Model and effort']").click();
  await $("select[aria-label='Model']").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("composer-settings.png");
  await $("summary[aria-label='Model and effort']").click();

  await composer.setValue("/");
  await $("[aria-label='Slash commands']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("slash-commands.png");
  await composer.clearValue();
}

async function captureChatSearch(): Promise<void> {
  await openRoute("/", "[contenteditable='true'][aria-label='Message']");
  const search = $("input[aria-label='Search chats']");
  if (!(await search.isDisplayed().catch(() => false))) {
    await $(
      "nav[aria-label='Workspace navigation'] button[aria-label='Home']",
    ).click();
  }
  await search.waitForDisplayed({ timeout: 10_000 });
  await search.setValue("fixed response");
  const searchRegion = $(
    "//input[@aria-label='Search chats']/ancestor::div[contains(@class, 'mb-4')][1]",
  );
  await browser.waitUntil(
    async () => {
      const section = searchRegion;
      return (
        (await section
          .$("ul")
          .isDisplayed()
          .catch(() => false)) ||
        (await section
          .$("p*=No matching chats.")
          .isDisplayed()
          .catch(() => false))
      );
    },
    {
      timeout: 10_000,
      timeoutMsg: "The chat search should render a result or empty state",
    },
  );
  await saveFixtureScreenshot("chat-search-results.png");
}

async function captureProjectDialogs(): Promise<void> {
  await openRoute("/projects", "h1=Projects");
  await $("button[aria-label='New project']").click();
  await $("h2=Create a project").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("project-create-dialog.png");

  await $("button[aria-label='Project icon: Folder']").click();
  await $("fieldset[aria-label='Project icon options']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("project-icon-picker.png");
  await $("button[aria-label='Briefcase']").click();

  await $("button[aria-label='Project color: Blue']").click();
  await $("fieldset[aria-label='Project color options']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("project-color-picker.png");
  await $("button[aria-label='Violet']").click();
  await $(
    "dialog .modal-box button[aria-label='Close create project dialog']",
  ).click();
}

async function captureAutomationStates(): Promise<void> {
  await openRoute("/schedules", "h1=Automation");
  await $("button[aria-label='New schedule']").click();
  await $("h2=Create a schedule").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Schedule name']").setValue(
    "Fixture review cadence",
  );
  await $("textarea[aria-label='Instructions']").setValue(
    "Review the UI fixture screenshots and report visual regressions.",
  );
  await $("select[aria-label='Cadence']").selectByAttribute("value", "weekly");
  await $("button[aria-label='Monday']").click();
  await $("button[aria-label='Wednesday']").click();
  await saveFixtureScreenshot("automation-create-dialog.png");

  await $("dialog .modal-box button[aria-label='Create schedule']").click();
  await $$(
    'button[aria-label="Edit schedule: Fixture review cadence"]',
  )[0].waitForDisplayed({
    timeout: 10_000,
  });
  await browser.waitUntil(
    async () =>
      (await $$('article[aria-label^="Open schedule:"]').length) ===
      PAGE_DENSITY_COUNTS.ordinary.schedules,
    {
      timeout: 10_000,
      timeoutMsg: "The ordinary Automation list should show its schedule card",
    },
  );
  await saveFixtureScreenshot("automation-ordinary.png");

  await $(
    "article[aria-label='Open schedule: Fixture review cadence']",
  ).click();
  await $("h1=Fixture review cadence").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("automation-detail-ordinary.png");
  await $("button[aria-label='Edit schedule: Fixture review cadence']").click();
  await $("h2=Edit schedule").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("automation-edit-dialog.png");
  await $(
    "dialog[aria-labelledby='schedule-dialog-title'] .modal-box button[aria-label='Close schedule dialog']",
  ).click();

  await openRoute("/schedules", "h1=Automation");

  await $$('button[aria-label="Run now: Fixture review cadence"]')[0].click();
  await $("h2=Run schedule now?").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("automation-action-dialog.png");
  await $("button[aria-label='Cancel']").click();
}

async function captureMcpDialogs(): Promise<void> {
  await openRoute("/settings/mcp-servers", "h1=MCP servers");
  await $("button[aria-label='Add MCP server']").click();
  await $("h2=Add MCP server").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("mcp-add-stdio-dialog.png");

  await $("select[aria-label='Transport']").selectByAttribute(
    "value",
    "streamableHttp",
  );
  await $("input[aria-label='URL']").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("mcp-add-http-dialog.png");
  await $(
    "dialog .modal-box button[aria-label='Close MCP server dialog']",
  ).click();

  await $("button[aria-label='Add MCP server']").click();
  await $("h2=Add MCP server").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Server name']").setValue("fixture-mcp");
  await $("select[aria-label='Transport']").selectByAttribute(
    "value",
    "streamableHttp",
  );
  await $("input[aria-label='URL']").setValue("http://127.0.0.1:3920/mcp");
  await $("dialog .modal-box button[aria-label='Add MCP server']").click();
  await browser.waitUntil(
    async () => {
      const text = await $("main").getText();
      return text.includes("fixture-mcp") && text.includes("Resources (1)");
    },
    {
      timeout: 30_000,
      timeoutMsg: "The HTTP MCP fixture should expose its configured resources",
    },
  );
  await browser.waitUntil(
    async () =>
      (await $$('details[data-testid^="mcp-server-details-"]').length) ===
      PAGE_DENSITY_COUNTS.ordinary.mcpServers,
    {
      timeout: 10_000,
      timeoutMsg: "The ordinary MCP settings list should show one server",
    },
  );
  await saveFixtureScreenshot("mcp-servers-ordinary.png");
  await $("[data-testid='mcp-server-details-fixture-mcp'] summary").click();
  await saveFixtureScreenshot("mcp-configured-resources.png");

  const resourceButton = $(
    "button[aria-label='Read example-note from fixture-mcp']",
  );
  await resourceButton.scrollIntoView({ block: "center" });
  await resourceButton.click();
  await $("[data-testid='mcp-resource-text']").waitForDisplayed({
    timeout: 10_000,
  });
  await saveFixtureScreenshot("mcp-resource-viewer.png");

  await $("button[aria-label='Edit fixture-mcp']").click();
  await $("h2=Edit MCP server").waitForDisplayed({ timeout: 10_000 });
  await saveFixtureScreenshot("mcp-edit-dialog.png");
  await $(
    "dialog .modal-box button[aria-label='Close MCP server dialog']",
  ).click();

  await openRoute("/capabilities/mcp", "h1=MCP");
  await browser.waitUntil(
    async () => (await $("main").getText()).includes("fixture-mcp"),
    {
      timeout: 30_000,
      timeoutMsg: "The MCP capabilities page should show the configured server",
    },
  );
  await saveFixtureScreenshot("capabilities-mcp-ordinary.png");
}
