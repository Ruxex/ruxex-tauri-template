import { mkdirSync } from "node:fs";
import path from "node:path";

import {
  buildScenarioMarker,
  type PersistentScenario,
  type ProjectFixture,
} from "./catalog";

export const MINIMAP_TURN_COUNT = 7;

export type ScenarioExpectation = {
  kind: "text" | "error" | "goal";
  value: string;
  alternatives?: readonly string[];
};

export function scenarioPrompt(
  scenario: PersistentScenario,
  occurrence: number,
): string {
  const marker = buildScenarioMarker(scenario, occurrence);
  return marker;
}

export function scenarioExpectation(
  scenario: PersistentScenario,
): ScenarioExpectation {
  if (scenario.kind === "goal") {
    return { kind: "goal", value: requireScenarioText(scenario.goalText) };
  }
  if (scenario.errorText) {
    return { kind: "error", value: scenario.errorText };
  }
  return {
    kind: "text",
    value: requireScenarioText(scenario.completionText),
    alternatives: scenario.alternateCompletionTexts,
  };
}

export async function waitForDesktopReady(): Promise<void> {
  try {
    await $("main").waitForDisplayed({ timeout: 30_000 });
  } catch (error) {
    const page = await browser
      .execute(() => ({
        url: window.location.href,
        readyState: document.readyState,
        text: document.body?.innerText.slice(0, 500) ?? "<no body>",
      }))
      .catch(() => null);
    throw new Error(
      `Desktop UI did not render its main content: ${JSON.stringify(page)}`,
      {
        cause: error,
      },
    );
  }
  await $("button[aria-label='Account']").click();
  await browser.waitUntil(
    async () => {
      const text = await $("main").getText();
      return text.includes("Authenticated");
    },
    {
      timeout: 30_000,
      timeoutMsg: "The fixture account should be available in Settings",
    },
  );
  await $("button[aria-label='Home']").click();
  await browser.waitUntil(
    async () => {
      const model = $("select[aria-label='Model']");
      return (await model.isExisting()) && Boolean(await model.getValue());
    },
    {
      timeout: 30_000,
      timeoutMsg: "The desktop App Server should provide a model",
    },
  );
}

export async function openNewChat(): Promise<void> {
  await browser.url("tauri://localhost/#/");
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
}

export async function waitForHomeReady(): Promise<void> {
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
  await browser.waitUntil(
    async () => !(await $("main").getText()).includes("Loading projects..."),
    {
      timeout: 10_000,
      timeoutMsg: "The Home project sidebar should finish loading",
    },
  );
}

export async function waitForRecentChatCount(
  expectedCount: number,
  timeout = 30_000,
): Promise<void> {
  const sidebar = $('aside[aria-label="Chat sidebar"]');
  await sidebar.waitForDisplayed({ timeout });

  try {
    await browser.waitUntil(
      async () =>
        (await $$("#recent-chats-list > ul > li").length) === expectedCount,
      {
        timeout,
        timeoutMsg: `Expected ${expectedCount} recent chats in the sidebar`,
      },
    );
  } catch (error) {
    const sidebarText = await sidebar.getText().catch(() => "<unavailable>");
    throw new Error(
      `Expected ${expectedCount} recent chats in the sidebar; current sidebar: ${sidebarText}`,
      { cause: error },
    );
  }
}

export async function closeSidebarPanel(): Promise<void> {
  const closeButton = $("button[aria-label='Close sidebar panel']");
  if (await closeButton.isDisplayed().catch(() => false)) {
    await closeButton.click();
  }
}

export async function sendScenario(
  scenario: PersistentScenario,
  occurrence: number,
): Promise<void> {
  await openNewChat();
  await sendScenarioFromCurrentComposer(scenario, occurrence);
}

export async function sendScenarioFromCurrentComposer(
  scenario: PersistentScenario,
  occurrence: number,
): Promise<void> {
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.setValue(scenarioPrompt(scenario, occurrence));

  if (scenario.kind === "goal") {
    await setCurrentGoal(scenario.goalText ?? "");
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes("/chat/"),
      {
        timeout: 10_000,
        timeoutMsg: "The goal thread should open after it is created",
      },
    );
    return;
  }

  await sendComposerMessage();
  if (scenario.kind === "approval") {
    await waitForPendingRequest();
    await resolveApproval(
      scenario.id === "approval-accepted" ? "accept" : "deny",
    );
  }

  if (scenario.kind === "multiTurn") {
    await waitForCompletedTurn({
      kind: "text",
      value: "This is turn 2 of the multi-turn test.",
    });
    await sendFollowUp("Continue the multi-turn fixture.");
    await waitForUserMessageCount(2);
    await waitForCompletedTurn({
      kind: "text",
      value: "This is the completion turn of the multi-turn test.",
    });
    await sendFollowUp("example:multi next");
    await waitForUserMessageCount(3);
    await waitForCompletedTurn({
      kind: "text",
      value: "This is the completion turn of the multi-turn test.",
    });
  }

  await waitForCompletedTurn(scenarioExpectation(scenario));
}

export async function sendFollowUp(text: string): Promise<void> {
  const previousCount = await $("[aria-label='Chat activity']").$$(
    "article.chat-end",
  ).length;
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(async () => message.isEnabled(), {
    timeout: 15_000,
    timeoutMsg: "The composer should be enabled for the follow-up turn",
  });
  await fillComposer(message, text);
  await sendComposerMessage();
  await waitForUserMessageCount(previousCount + 1);
}

async function fillComposer(
  message: WebdriverIO.Element,
  text: string,
): Promise<void> {
  await message.setValue(text);
  await browser.waitUntil(async () => (await message.getText()) === text, {
    timeout: 5_000,
    timeoutMsg: "The chat editor should contain the complete prompt",
  });
}

async function waitForAssistantMessageCount(count: number): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await $("[aria-label='Chat activity']").$$("article.chat-start")
        .length) >= count,
    {
      timeout: 45_000,
      timeoutMsg: `Expected at least ${count} assistant responses`,
    },
  );
}

export async function sendComposerPrompt(prompt: string): Promise<void> {
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.waitForDisplayed({ timeout: 10_000 });
  await fillComposer(message, prompt);
  await sendComposerMessage();
}

export function minimapFixturePrompt(turn: number): string {
  return `Fixture minimap message ${String(turn).padStart(2, "0")} example:basic`;
}

export async function sendMinimapConversation(
  timeout = 45_000,
): Promise<void> {
  const expectation = {
    kind: "text" as const,
    value: "This is a fixed response from the dummy provider.",
  };

  await sendComposerPrompt(minimapFixturePrompt(1));
  await waitForCompletedTurn(expectation, timeout);
  for (let turn = 2; turn <= MINIMAP_TURN_COUNT; turn += 1) {
    await sendFollowUp(minimapFixturePrompt(turn));
    await waitForUserMessageCount(turn);
    await waitForAssistantMessageCount(turn);
    await waitForTurnFinish();
    await waitForCompletedTurn(expectation);
  }
}

export async function waitForUserMessageCount(count: number): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await $$(`[aria-label='Chat activity'] article.chat-end`)).length >=
      count,
    {
      timeout: 15_000,
      timeoutMsg: `Expected at least ${count} user messages in the conversation`,
    },
  );
}

export async function expandCompletedTurnDetails(): Promise<void> {
  const details = $("[aria-label='Chat activity'] > details");
  const summary = $("[aria-label='Chat activity'] > details > summary");
  await details.waitForDisplayed({ timeout: 15_000 });
  await summary.click();
  await browser.waitUntil(
    async () => (await details.getAttribute("open")) !== null,
    {
      timeout: 5_000,
      timeoutMsg: "The completed turn details should be expanded",
    },
  );
}

export async function withWindowSize<T>(
  width: number,
  height: number,
  callback: () => Promise<T>,
): Promise<T> {
  const original = await browser.getWindowSize();
  await browser.setWindowSize(width, height);
  try {
    return await callback();
  } finally {
    await browser.setWindowSize(original.width, original.height);
  }
}

export async function selectSubmissionMode(
  mode: "send" | "queue",
): Promise<void> {
  await $("summary[aria-label='Submission mode menu']").click();
  const label = mode === "queue" ? "Queue next message" : "Send";
  await $(`button[aria-label='${label}'][role='menuitem']`).click();
}

export async function sendQueuedPrompt(prompt: string): Promise<void> {
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.waitForDisplayed({ timeout: 10_000 });
  await message.setValue(prompt);
  await $(
    "//*[@contenteditable='true' and @aria-label='Message']/ancestor::form[1]//button[@type='submit'][@aria-label='Queue']",
  ).click();
}

export async function waitForActiveTurn(): Promise<void> {
  await $("button[aria-label='Stop']").waitForDisplayed({ timeout: 10_000 });
}

async function sendComposerMessage(): Promise<void> {
  const submit = $(
    "//*[@contenteditable='true' and @aria-label='Message']/ancestor::form[1]//button[@type='submit']",
  );
  await browser.waitUntil(
    async () =>
      (await submit.getAttribute("aria-label")) === "Send" &&
      (await submit.isEnabled()),
    {
      timeout: 10_000,
      timeoutMsg: "The composer should be ready to send a new turn",
    },
  );
  await submit.click();
}

export async function waitForCompletedTurn(
  expectation: ScenarioExpectation,
  timeout = 45_000,
): Promise<void> {
  await browser.waitUntil(
    async () => {
      const text = await $(".workbench-main").getText();
      const normalized = text.toLowerCase();
      return [expectation.value, ...(expectation.alternatives ?? [])].some(
        (value) => normalized.includes(value.toLowerCase()),
      );
    },
    {
      timeout,
      timeoutMsg: `Expected ${expectation.kind} text: ${expectation.value}`,
    },
  );
  await waitForTurnFinish();
}

export async function waitForTurnFinish(): Promise<void> {
  await browser.waitUntil(
    async () => !(await $("button[aria-label='Stop']").isExisting()),
    {
      timeout: 15_000,
      timeoutMsg: "The fixture turn should finish before the helper returns",
    },
  );
}

export async function waitForPendingRequest(): Promise<void> {
  await browser.waitUntil(
    async () =>
      (
        await Promise.all(
          [
            "Approve once",
            "Approve in this chat",
            "Reject",
            "Allow",
            "Deny",
          ].map(async (label) =>
            $(`button[aria-label='${label}']`)
              .isDisplayed()
              .catch(() => false),
          ),
        )
      ).some(Boolean),
    {
      timeout: 30_000,
      timeoutMsg: "The approval controls should be displayed",
    },
  );
}

export async function resolveApproval(
  decision: "accept" | "deny",
): Promise<void> {
  const label = decision === "accept" ? "Approve once" : "Reject";
  await $(`button[aria-label='${label}']`).click();
}

export async function submitUserInput(answer: string): Promise<void> {
  const card = $(
    "//*[@aria-label='Chat activity']//article[.//button[@aria-label='Submit']]",
  );
  const otherOption = card.$("input[type='radio'][value='None of the above']");
  await otherOption.waitForDisplayed({ timeout: 30_000 });
  await otherOption.click();
  await card.$("textarea").setValue(answer);
  await card.$("button[aria-label='Submit']").click();
}

export async function createRootlessProject(
  project: ProjectFixture,
): Promise<void> {
  await $(
    "nav[aria-label='Workspace navigation'] button[aria-label='Projects']",
  ).click();
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await waitForProjectsPageReady();
  await $("button[aria-label='New project']").click();
  await $("dialog").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Project name']").setValue(project.name);
  await chooseProjectMetadata("icon", project.icon);
  await chooseProjectMetadata("color", project.color);
  await $("dialog button[aria-label='Create project']").click();
  try {
    await $(`h1=${project.name}`).waitForDisplayed({ timeout: 10_000 });
  } catch (error) {
    const dialogText = await $("dialog")
      .getText()
      .catch(() => "<dialog closed>");
    const pageText = await $("main")
      .getText()
      .catch(() => "<main unavailable>");
    throw new Error(
      `Project ${project.name} was not opened after creation. Dialog: ${dialogText}. Page: ${pageText}`,
      { cause: error },
    );
  }
}

async function waitForProjectsPageReady(timeout = 30_000): Promise<void> {
  const projectTable = $('table[aria-label="Projects"]');
  const emptyState = $("h3=No projects yet");
  const error = $("main [role='alert']");
  const retry = $("main [role='alert'] button");

  try {
    await browser.waitUntil(
      async () => {
        if (
          (await projectTable.isDisplayed().catch(() => false)) ||
          (await emptyState.isDisplayed().catch(() => false))
        ) {
          return true;
        }

        if (
          (await error.isDisplayed().catch(() => false)) &&
          (await retry.isDisplayed().catch(() => false)) &&
          (await retry.isEnabled())
        ) {
          await retry.click();
          await browser.pause(500);
        }
        return false;
      },
      {
        timeout,
        timeoutMsg: "Projects did not finish loading",
      },
    );
  } catch (cause) {
    const pageText = await $("main").getText().catch(() => "<unavailable>");
    throw new Error(`Projects did not become ready. Page: ${pageText}`, {
      cause,
    });
  }
}

export async function createFixtureSchedule(name: string): Promise<void> {
  await $("button[aria-label='New schedule']").click();
  await $("h2=Create a schedule").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Schedule name']").setValue(name);
  await $("textarea[aria-label='Instructions']").setValue(
    `Review the fixture page density for ${name}.`,
  );
  await $("select[aria-label='Cadence']").selectByAttribute("value", "weekly");
  const monday = $("button[aria-label='Monday']");
  if ((await monday.getAttribute("aria-pressed")) !== "true") {
    await monday.click();
  }
  await $("button[aria-label='Create schedule']").click();
  try {
    await $(`button[aria-label='Edit schedule: ${name}']`).waitForDisplayed({
      timeout: 10_000,
    });
  } catch (error) {
    const dialogText = await $(
      "dialog[aria-labelledby='schedule-dialog-title']",
    )
      .getText()
      .catch(() => "<dialog closed>");
    const pageText = await $("main")
      .getText()
      .catch(() => "<main unavailable>");
    throw new Error(
      `Schedule ${name} was not listed after creation. Dialog: ${dialogText}. Page: ${pageText}`,
      { cause: error },
    );
  }
}

export async function createWorkspaceProject(
  name: string,
  workspace: string,
): Promise<string> {
  await $(
    "nav[aria-label='Workspace navigation'] button[aria-label='Projects']",
  ).click();
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await $("button[aria-label='New project']").click();
  await $("dialog").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Project name']").setValue(name);

  await browser.execute((selectedWorkspaceFolder: string) => {
    if (!window.__RUXEX_E2E__) {
      throw new Error("The E2E workspace selection hook is unavailable");
    }
    window.__RUXEX_E2E__.selectedWorkspaceFolder = selectedWorkspaceFolder;
  }, workspace);
  await $("button[aria-label='Select workspace folder']").click();
  const selectedFolder = $("button[aria-label^='Selected workspace folder: ']");
  await browser.waitUntil(
    async () =>
      (await selectedFolder.getAttribute("aria-label")) ===
      `Selected workspace folder: ${workspace}`,
    {
      timeout: 5_000,
      timeoutMsg: `The selected workspace folder did not match. Expected ${workspace}; dialog: ${await $(
        "dialog",
      )
        .getText()
        .catch(() => "<closed>")}`,
    },
  );
  await $("button[aria-label='Create project']").click();
  await $(`h1=${name}`).waitForDisplayed({ timeout: 10_000 });
  const match = (await browser.getUrl()).match(/\/projects\/([^/?#]+)/);
  if (!match) throw new Error(`Project ${name} was created without opening it`);
  return match[1];
}

export async function inspectDiffFileControls(): Promise<
  Array<{ label: string; expanded: string | null }>
> {
  return browser.execute(() => {
    function findButtons(root: Document | ShadowRoot): HTMLButtonElement[] {
      const descendants = Array.from(root.querySelectorAll("*"));
      return [
        ...Array.from(
          root.querySelectorAll<HTMLButtonElement>(
            "button[aria-label^='Collapse '], button[aria-label^='Expand ']",
          ),
        ),
        ...descendants.flatMap((element) =>
          element.shadowRoot ? findButtons(element.shadowRoot) : [],
        ),
      ];
    }

    return findButtons(document).map((button) => ({
      label: button.getAttribute("aria-label") ?? "",
      expanded: button.getAttribute("aria-expanded"),
    }));
  });
}

export async function clickDiffFileControl(label: string): Promise<void> {
  await $(`>>>button[aria-label="${label}"]`).click();
}

export async function openProjectChat(projectName: string): Promise<void> {
  const projectHeading = $(`h1=${projectName}`);
  if (!(await projectHeading.isDisplayed().catch(() => false))) {
    await $(
      "nav[aria-label='Workspace navigation'] button[aria-label='Projects']",
    ).click();
    await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
    await $(
      `//table[@aria-label='Projects']//a[normalize-space(.)='${projectName}']`,
    ).click();
    await projectHeading.waitForDisplayed({ timeout: 10_000 });
  }

  const newChat = $(
    "(//section[contains(@class, 'workbench-main')]//a[normalize-space(.)='New chat'])[1]",
  );
  await newChat.waitForDisplayed({ timeout: 10_000 });
  await newChat.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes("?projectId="),
    {
      timeout: 10_000,
      timeoutMsg: "The project-scoped new chat route should open",
    },
  );
  await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
}

export async function archiveCurrentThread(): Promise<void> {
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.setValue("/archive");
  await $("button[aria-label='Archive']").click();
  await browser.waitUntil(
    async () => !(await $("button[aria-label='Archive']").isExisting()),
    {
      timeout: 10_000,
      timeoutMsg: "The archive command should clear the composer action",
    },
  );
}

export async function setCurrentGoal(objective: string): Promise<void> {
  const options = $("summary[aria-label='Composer options']");
  if (await options.isExisting()) {
    await options.click();
  }
  const goalMode = $("button[aria-label='Goal mode']");
  if (await goalMode.isExisting()) {
    await goalMode.click();
  }
  const message = $("[contenteditable='true'][aria-label='Message']");
  await message.setValue(objective);
  await $("button[aria-label='Send']").click();
}

export async function saveFixtureScreenshot(name: string): Promise<void> {
  const artifactDirectory = process.env.RUXEX_E2E_ARTIFACTS ?? "artifacts";
  mkdirSync(artifactDirectory, { recursive: true });
  await browser.pause(300);
  if (process.env.GDK_BACKEND === "x11" && process.env.RUXEX_E2E_ARTIFACTS) {
    await browser.execute(async (screenshotName: string) => {
      const capture = window.__RUXEX_E2E__?.captureScreenshot;
      if (!capture) {
        throw new Error("The E2E screenshot command is unavailable");
      }
      await capture(screenshotName);
    }, name);
  } else {
    await browser.saveScreenshot(path.join(artifactDirectory, name));
  }
  await browser.pause(300);
}

async function chooseProjectMetadata(
  kind: "icon" | "color",
  value: string,
): Promise<void> {
  const current = kind === "icon" ? "Folder" : "Blue";
  const selected =
    kind === "icon" ? projectIconLabel(value) : capitalize(value);
  await $(`button[aria-label='Project ${kind}: ${current}']`).click();
  await $(
    `fieldset[aria-label='Project ${kind} options'] button[aria-label='${selected}']`,
  ).click();
}

function projectIconLabel(value: string): string {
  return value === "globe" ? "Website" : capitalize(value);
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function requireScenarioText(value: string | undefined): string {
  if (!value) {
    throw new Error("Fixture scenario is missing its expected text");
  }
  return value;
}
