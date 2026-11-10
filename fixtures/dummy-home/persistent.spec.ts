import {
  buildScenarioTitle,
  PERSISTENT_SCENARIOS,
  PROJECT_FIXTURES,
  persistentFixtureCounts,
} from "./catalog";
import {
  archiveCurrentThread,
  createRootlessProject,
  openProjectChat,
  sendScenario,
  sendScenarioFromCurrentComposer,
  waitForDesktopReady,
} from "./support";

describe("Persistent DummyProvider home", () => {
  it("creates the catalog through the desktop UI", async () => {
    await waitForDesktopReady();

    const projectScenarioOccurrences = new Set([
      "basic:1",
      "multi-turn:1",
      "command-success:1",
    ]);

    for (const project of PROJECT_FIXTURES) {
      await createRootlessProject(project);
      for (const scenarioId of project.threadScenarioIds) {
        const scenario = findScenario(scenarioId);
        const occurrence = 1;
        await openProjectChat(project.name);
        await sendScenarioFromCurrentComposer(scenario, occurrence);
      }
    }

    for (const scenario of PERSISTENT_SCENARIOS) {
      for (let occurrence = 1; occurrence <= scenario.count; occurrence += 1) {
        if (projectScenarioOccurrences.has(`${scenario.id}:${occurrence}`)) {
          continue;
        }
        await sendScenario(scenario, occurrence);
        if (scenario.archiveOccurrences?.includes(occurrence)) {
          await archiveCurrentThread();
        }
      }
    }

    await assertListCounts();
    await assertProjectCounts();
    await assertRepresentativeHistory();
  });
});

function findScenario(id: string) {
  const scenario = PERSISTENT_SCENARIOS.find(
    (candidate) => candidate.id === id,
  );
  if (!scenario) {
    throw new Error(`Missing persistent fixture scenario: ${id}`);
  }
  return scenario;
}

async function assertListCounts(): Promise<void> {
  const counts = persistentFixtureCounts();
  await browser.url("tauri://localhost/#/");
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
  await browser.waitUntil(
    async () =>
      (await $$("#recent-chats-list > ul > li").length) === counts.active,
    {
      timeout: 10_000,
      timeoutMsg: `Expected ${counts.active} active threads`,
    },
  );

  await browser.url("tauri://localhost/#/archive");
  await $("h1=Archived chats").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => (await $$("article.card").length) === counts.archived,
    {
      timeout: 10_000,
      timeoutMsg: `Expected ${counts.archived} archived threads`,
    },
  );
}

async function assertProjectCounts(): Promise<void> {
  await browser.url("tauri://localhost/#/projects");
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(async () => (await $$("tbody tr").length) === 3, {
    timeout: 10_000,
    timeoutMsg: "Expected three projects",
  });

  for (const [index, project] of PROJECT_FIXTURES.entries()) {
    await $(`a=${project.name}`).click();
    await $(`h1=${project.name}`).waitForDisplayed({ timeout: 10_000 });
    const expectedThreadCount = project.threadScenarioIds.length;
    await browser.waitUntil(
      async () => (await $$("section.card a").length) === expectedThreadCount,
      {
        timeout: 10_000,
        timeoutMsg: `Expected ${expectedThreadCount} threads in ${project.name}`,
      },
    );
    if (index < PROJECT_FIXTURES.length - 1) {
      await browser.url("tauri://localhost/#/projects");
      await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
    }
  }
}

async function assertRepresentativeHistory(): Promise<void> {
  await browser.url("tauri://localhost/#/");
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
  for (const id of ["long-markdown", "multi-turn", "command-success"]) {
    const title = buildScenarioTitle(findScenario(id), 1);
    await $(
      `//div[@id='recent-chats-list']//a[contains(normalize-space(.), '${title}')]`,
    ).click();
    await $("[aria-label='Chat activity']").waitForDisplayed({
      timeout: 10_000,
    });
    await browser.url("tauri://localhost/#/");
    await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
      timeout: 10_000,
    });
  }
}
