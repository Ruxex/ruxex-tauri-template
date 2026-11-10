import {
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
  const { active } = persistentFixtureCounts();
  await browser.url("tauri://localhost/#/");
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
  await browser.waitUntil(
    async () => (await $$("#recent-chats-list > ul > li").length) === active,
    {
      timeout: 10_000,
      timeoutMsg: `Expected ${active} active threads`,
    },
  );

  await browser.url("tauri://localhost/#/archive");
  await $("h1=Archived chats").waitForDisplayed({ timeout: 10_000 });
  await browser.refresh();
  await $("h1=Archived chats").waitForDisplayed({ timeout: 10_000 });
}

async function assertProjectCounts(): Promise<void> {
  await browser.url("tauri://localhost/#/projects");
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(async () => (await $$("tbody tr").length) === 3, {
    timeout: 10_000,
    timeoutMsg: "Expected three projects",
  });

  for (const [index, project] of PROJECT_FIXTURES.entries()) {
    await $(
      `tr[aria-label='Open project ${project.name}'] td:first-child`,
    ).click();
    await $(`h1=${project.name}`).waitForDisplayed({ timeout: 10_000 });
    const expectedThreadCount = project.threadScenarioIds.length;
    await browser.waitUntil(
      async () =>
        (await $("section.card").$$("a")).length ===
        Math.max(expectedThreadCount, 1),
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
  await browser.url("tauri://localhost/#/projects");
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await $(
    "tr[aria-label='Open project Product planning'] td:first-child",
  ).click();
  await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
  const projectChats = $("section.card").$$("a");
  await projectChats[0].waitForDisplayed({ timeout: 10_000 });
  await projectChats[0].click();
  await $("[aria-label='Chat activity']").waitForDisplayed({
    timeout: 10_000,
  });
}
