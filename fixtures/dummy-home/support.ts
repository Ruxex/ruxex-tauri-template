import { mkdirSync } from "node:fs";
import path from "node:path";

import {
  buildScenarioMarker,
  type PersistentScenario,
  type ProjectFixture,
} from "./catalog";

export type ScenarioExpectation = {
  kind: "text" | "error" | "goal";
  value: string;
};

export function scenarioPrompt(
  scenario: PersistentScenario,
  occurrence: number,
): string {
  return buildScenarioMarker(scenario, occurrence);
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
  return { kind: "text", value: requireScenarioText(scenario.completionText) };
}

export async function waitForDesktopReady(): Promise<void> {
  await $("main").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => {
      const text = await $("main").getText();
      return (
        text.includes("ModelABC") &&
        !text.toLowerCase().includes("app-server is not connected")
      );
    },
    {
      timeout: 30_000,
      timeoutMsg: "The desktop App Server should be ready",
    },
  );
}

export async function openNewChat(): Promise<void> {
  const newChat = $('nav[aria-label="Chat navigation"] a[href="/"]');
  await newChat.waitForDisplayed({ timeout: 10_000 });
  await newChat.click();
  await $("textarea[aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
}

export async function sendScenario(
  scenario: PersistentScenario,
  occurrence: number,
): Promise<void> {
  await openNewChat();
  const message = $("textarea[aria-label='Message']");
  await message.setValue(scenarioPrompt(scenario, occurrence));

  if (scenario.kind === "goal") {
    await setCurrentGoal(scenario.goalText ?? "");
    return;
  }

  await $("button[aria-label='Send']").click();
  if (scenario.kind === "approval") {
    await waitForPendingRequest();
    await resolveApproval(
      scenario.id === "approval-accepted" ? "accept" : "deny",
    );
  }
  await waitForCompletedTurn(scenarioExpectation(scenario));
}

export async function sendFollowUp(text: string): Promise<void> {
  const message = $("textarea[aria-label='Message']");
  await message.waitForDisplayed({ timeout: 10_000 });
  await message.setValue(text);
  await $("button[aria-label='Send']").click();
}

export async function waitForCompletedTurn(
  expectation: ScenarioExpectation,
): Promise<void> {
  await browser.waitUntil(
    async () => {
      const text = await $("main").getText();
      const normalized = text.toLowerCase();
      return normalized.includes(expectation.value.toLowerCase());
    },
    {
      timeout: 45_000,
      timeoutMsg: `Expected ${expectation.kind} text: ${expectation.value}`,
    },
  );
  await browser.waitUntil(
    async () => !(await $("button[aria-label='Stop']").isExisting()),
    {
      timeout: 15_000,
      timeoutMsg: "The fixture turn should finish before the helper returns",
    },
  );
}

export async function waitForPendingRequest(): Promise<void> {
  await $("[aria-label='Chat activity'] article").waitForDisplayed({
    timeout: 30_000,
  });
}

export async function resolveApproval(
  decision: "accept" | "deny",
): Promise<void> {
  const label = decision === "accept" ? "Allow" : "Deny";
  await $(`button[aria-label='${label}']`).click();
}

export async function submitUserInput(answer: string): Promise<void> {
  const input = $("[aria-label='Chat activity'] article input");
  await input.waitForDisplayed({ timeout: 30_000 });
  await input.setValue(answer);
  await $("button[aria-label='Submit']").click();
}

export async function createRootlessProject(
  project: ProjectFixture,
): Promise<void> {
  await $('a[href="/projects"]').click();
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await $("button[aria-label='New project']").click();
  await $("dialog").waitForDisplayed({ timeout: 10_000 });
  await $("input[aria-label='Project name']").setValue(project.name);
  await chooseProjectMetadata("icon", project.icon);
  await chooseProjectMetadata("color", project.color);
  await $("button[aria-label='Create project']").click();
  await $(`h1=${project.name}`).waitForDisplayed({ timeout: 10_000 });
}

export async function openProjectChat(): Promise<void> {
  await $("a[href*='?projectId=']").click();
  await $("textarea[aria-label='Message']").waitForDisplayed({
    timeout: 10_000,
  });
}

export async function archiveCurrentThread(): Promise<void> {
  const message = $("textarea[aria-label='Message']");
  await message.setValue("/archive");
  await $("button[aria-label='Archive']").click();
  await browser.waitUntil(async () => !(await message.isExisting()), {
    timeout: 10_000,
    timeoutMsg: "The archived thread should leave the conversation route",
  });
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
  const message = $("textarea[aria-label='Message']");
  await message.setValue(objective);
  await $("button[aria-label='Set goal']").click();
}

export async function saveFixtureScreenshot(name: string): Promise<void> {
  const artifactDirectory = process.env.RUXEX_E2E_ARTIFACTS ?? "artifacts";
  mkdirSync(artifactDirectory, { recursive: true });
  await browser.saveScreenshot(path.join(artifactDirectory, name));
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
