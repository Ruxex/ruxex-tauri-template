import { saveFixtureScreenshot, waitForDesktopReady } from "./support";

/** Read-only route coverage after selecting the language through the real UI. */
describe("Japanese desktop UI", () => {
  it("captures home, project, chat and settings with localized accessible names", async () => {
    // Recover the fixture after an interrupted run using the stable control id.
    await browser.url("tauri://localhost/#/settings");
    await $("#settings-language").waitForDisplayed({ timeout: 10_000 });
    await $("#settings-language").selectByAttribute("value", "en");
    await browser.keys("Tab");
    await waitForDesktopReady();
    await browser.url("tauri://localhost/#/settings");
    const language = $("select[aria-label='Language']");
    await language.waitForDisplayed({ timeout: 10_000 });
    await language.selectByAttribute("value", "ja");
    await browser.keys("Tab");

    try {
      await $("h2=一般").waitForDisplayed({ timeout: 10_000 });
      await $("select[aria-label='言語']").waitForDisplayed();
      await saveFixtureScreenshot("japanese-settings-general.png");
      await assertJapaneseDocument();

      await browser.url("tauri://localhost/#/");
      await $(
        "[contenteditable='true'][aria-label='メッセージ']",
      ).waitForDisplayed({ timeout: 10_000 });
      await $("button[aria-label='送信']").waitForDisplayed();
      await saveFixtureScreenshot("japanese-home.png");
      await assertJapaneseDocument();

      await browser.url("tauri://localhost/#/projects");
      await $("h1=プロジェクト").waitForDisplayed({ timeout: 10_000 });
      const project = $(
        "table[aria-label='プロジェクト'] tbody tr:first-child a[href*='/projects/']",
      );
      await project.waitForDisplayed({ timeout: 15_000 });
      await $("button[aria-label='新規プロジェクト']").waitForDisplayed();
      await saveFixtureScreenshot("japanese-projects.png");
      await project.click();
      const chat = $(
        "section[aria-label='チャット'] tbody tr:first-child a[href*='/chat/']",
      );
      await chat.waitForDisplayed({ timeout: 15_000 });
      await saveFixtureScreenshot("japanese-project-detail.png");
      await assertJapaneseDocument();
      await chat.click();
      await $(
        "[contenteditable='true'][aria-label='メッセージ']",
      ).waitForDisplayed({ timeout: 15_000 });
      await $("button[aria-label='送信']").waitForDisplayed();
      await saveFixtureScreenshot("japanese-chat.png");
      await assertJapaneseDocument();

      await browser.url("tauri://localhost/#/settings/appearance");
      await $("h2=外観").waitForDisplayed({ timeout: 10_000 });
      await saveFixtureScreenshot("japanese-settings-appearance.png");
      await assertJapaneseDocument();
    } catch (error) {
      await saveFixtureScreenshot("japanese-ui-failure.png");
      throw error;
    } finally {
      // The prepared home is shared with English fixtures in later recipes.
      await browser.url("tauri://localhost/#/settings");
      const resetLanguage = $("#settings-language");
      await resetLanguage.waitForDisplayed({ timeout: 10_000 });
      await resetLanguage.selectByAttribute("value", "en");
    }
  });
});

async function assertJapaneseDocument(): Promise<void> {
  const result = await browser.execute(() => ({
    language: document.documentElement.lang,
    horizontalOverflow:
      document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  if (result.language !== "ja" || result.horizontalOverflow) {
    throw new Error(
      `Japanese page metadata/overflow: ${JSON.stringify(result)}`,
    );
  }
}
