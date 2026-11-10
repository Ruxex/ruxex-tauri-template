import { VOLATILE_SCENARIOS } from "./catalog";
import {
  closeSidebarPanel,
  openNewChat,
  resolveApproval,
  saveFixtureScreenshot,
  selectSubmissionMode,
  sendComposerPrompt,
  sendQueuedPrompt,
  submitUserInput,
  waitForActiveTurn,
  waitForCompletedTurn,
  waitForDesktopReady,
  waitForPendingRequest,
  waitForTurnFinish,
} from "./support";

describe("Volatile DummyProvider event states", () => {
  before(async () => {
    await waitForDesktopReady();
  });

  for (const scenario of VOLATILE_SCENARIOS.filter(
    (candidate) => candidate.count > 0,
  )) {
    it(`captures ${scenario.id}`, async () => {
      await openNewChat();
      const prompt = `Fixture volatile ${scenario.id} ${scenario.providerMarker}`;

      switch (scenario.id) {
        case "pending-approval":
          await sendComposerPrompt(prompt);
          await waitForPendingRequest();
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          await resolveApproval("deny");
          await waitForPendingControlsGone();
          return;
        case "pending-user-input":
          await sendComposerPrompt(prompt);
          await $(
            "[aria-label='Chat activity'] article input",
          ).waitForDisplayed({
            timeout: 30_000,
          });
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          await submitUserInput("Fixture user input answer");
          await waitForCompletedTurn({
            kind: "text",
            value: "The fixed user input was received.",
          });
          return;
        case "pending-permissions":
          await sendComposerPrompt(prompt);
          await waitForPendingRequest();
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          await resolveApproval("deny");
          await waitForPendingControlsGone();
          return;
        case "slow-stream":
          await sendComposerPrompt(prompt);
          await waitForActiveTurn();
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          await $("button[aria-label='Stop']").click();
          await waitForTurnFinish();
          return;
        case "queued-message":
          await sendComposerPrompt(prompt);
          await waitForActiveTurn();
          await selectSubmissionMode("queue");
          await sendQueuedPrompt("Fixture queued follow-up [[example:basic]]");
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          await $("button[aria-label='Stop']").click();
          await waitForTurnFinish();
          return;
        case "disconnect-recovery":
          await sendComposerPrompt(prompt);
          await waitForCompletedTurn({
            kind: "error",
            value: "example provider disconnected after partial output",
          });
          await closeSidebarPanel();
          await saveFixtureScreenshot(scenario.screenshotName);
          return;
        case "pending-mcp-elicitation":
          throw new Error("MCP elicitation is disabled in the default catalog");
      }
    });
  }
});

async function waitForPendingControlsGone(): Promise<void> {
  await browser.waitUntil(
    async () =>
      !(await $("button[aria-label='Approve once']").isExisting()) &&
      !(await $("button[aria-label='Approve in this chat']").isExisting()) &&
      !(await $("button[aria-label='Reject']").isExisting()) &&
      !(await $("button[aria-label='Allow']").isExisting()) &&
      !(await $("button[aria-label='Deny']").isExisting()) &&
      !(await $("button[aria-label='Submit']").isExisting()),
    {
      timeout: 15_000,
      timeoutMsg: "The volatile pending request should be resolved",
    },
  );
}
