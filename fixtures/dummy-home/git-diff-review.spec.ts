import {
  clickDiffFileControl,
  createWorkspaceProject,
  inspectDiffFileControls,
  saveFixtureScreenshot,
  sendComposerPrompt,
  waitForCompletedTurn,
  waitForDesktopReady,
} from "./support";

describe("Git diff review right pane", () => {
  it("opens committed-workspace changes from a new project chat", async () => {
    const workspace = process.env.RUXEX_E2E_GIT_DIFF_WORKSPACE;
    if (!workspace) {
      throw new Error("RUXEX_E2E_GIT_DIFF_WORKSPACE is required");
    }

    await waitForDesktopReady();
    const projectId = await createWorkspaceProject("Git diff review fixture", workspace);
    await browser.url(`tauri://localhost/#/projects/${projectId}`);
    await $("h1=Git diff review fixture").waitForDisplayed({ timeout: 15_000 });
    await $$("//main//a[normalize-space(.)='New chat']")[0].click();
    await $("[contenteditable='true'][aria-label='Message']").waitForDisplayed({
      timeout: 10_000,
    });
    await browser.waitUntil(async () => (await browser.getUrl()).includes(`?projectId=${projectId}`), {
      timeout: 15_000,
      timeoutMsg: "The new chat should load the selected workspace project",
    });
    await $("summary[aria-label='Project']").waitForDisplayed({
      timeout: 10_000,
    });
    await $("summary[aria-label='Project']").click();
    const projectSearch = $("input[aria-label='Search projects']");
    await projectSearch.waitForDisplayed({ timeout: 10_000 });
    await projectSearch.setValue("Git diff review fixture");
    const projectOption = `button[id$='-project-${projectId}']`;
    await $(projectOption).waitForDisplayed({ timeout: 10_000 });
    await $(projectOption).click();

    await sendComposerPrompt("example:basic");
    await waitForCompletedTurn({
      kind: "text",
      value: "This is a fixed response from the dummy provider.",
    });
    await browser.waitUntil(
      async () => {
        const reviewButtons = await $$("[data-testid='thread-summary-panel'] section button");
        for (const button of reviewButtons) {
          if (await button.isDisplayed().catch(() => false)) return true;
        }
        return false;
      },
      {
        timeout: 15_000,
        timeoutMsg: "The Git diff summary button should be visible",
      },
    );
    const reviewButtons = await $$("[data-testid='thread-summary-panel'] section button");
    let reviewButton = reviewButtons[0];
    for (const button of reviewButtons) {
      if (await button.isDisplayed().catch(() => false)) {
        reviewButton = button;
        break;
      }
    }
    await reviewButton.click();
    await $("[role='tabpanel'] section[aria-label='Code Changes']").waitForDisplayed({
      timeout: 10_000,
    });

    await browser.waitUntil(
      async () => {
        const controls = await inspectDiffFileControls();
        return (
          controls.some((control) => control.label === "Collapse README.md" && control.expanded === "true") &&
          controls.some((control) => control.label === "Collapse src/main.ts" && control.expanded === "true")
        );
      },
      {
        timeout: 15_000,
        timeoutMsg: "Both diff files should start expanded in the right pane",
      },
    );
    await saveFixtureScreenshot("git-diff-review.png");

    await clickDiffFileControl("Collapse README.md");
    await browser.waitUntil(
      async () =>
        (await inspectDiffFileControls()).some(
          (control) => control.label === "Expand README.md" && control.expanded === "false",
        ),
      {
        timeout: 10_000,
        timeoutMsg: "The README diff should collapse independently",
      },
    );
    await clickDiffFileControl("Expand README.md");
    await browser.waitUntil(
      async () =>
        (await inspectDiffFileControls()).some(
          (control) => control.label === "Collapse README.md" && control.expanded === "true",
        ),
      {
        timeout: 10_000,
        timeoutMsg: "The README diff should expand again",
      },
    );
  });
});
