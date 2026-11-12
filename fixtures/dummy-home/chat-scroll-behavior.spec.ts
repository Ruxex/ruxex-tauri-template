import {
  saveFixtureScreenshot,
  sendMinimapConversation,
  waitForDesktopReady,
  withWindowSize,
} from "./support";

async function openFixtureThread(): Promise<void> {
  await browser.url("tauri://localhost/#/projects");
  await $("h1=Projects").waitForDisplayed({ timeout: 10_000 });
  await $(
    "tr[aria-label='Open project Product planning'] td:first-child",
  ).click();
  await $("h1=Product planning").waitForDisplayed({ timeout: 10_000 });
  await $("section.card").$$("a")[0].click();
  await $("[aria-label='Chat activity']").waitForDisplayed({ timeout: 10_000 });
}

describe("Chat scroll behavior", () => {
  before(async () => {
    await waitForDesktopReady();
    await openFixtureThread();
    await sendMinimapConversation();
  });

  it("keeps side columns anchored while the chat scroll container moves", async () => {
    await withWindowSize(1920, 800, async () => {
      const scroll = $("[data-conversation-scroll='true']");
      const minimap = $("[aria-label='Conversation minimap']");
      const summary = $("[data-testid='thread-summary-panel']");
      const initial = await browser.execute(() => {
        const scrollElement = document.querySelector<HTMLElement>(
          "[data-conversation-scroll='true']",
        );
        const minimapElement = document.querySelector<HTMLElement>(
          "[aria-label='Conversation minimap']",
        );
        const summaryElement = document.querySelector<HTMLElement>(
          "[data-testid='thread-summary-panel']",
        );
        return {
          clientHeight: scrollElement?.clientHeight ?? 0,
          scrollHeight: scrollElement?.scrollHeight ?? 0,
          scrollTop: scrollElement?.scrollTop ?? 0,
          minimapTop: minimapElement?.getBoundingClientRect().top ?? null,
          summaryTop: summaryElement?.getBoundingClientRect().top ?? null,
        };
      });

      if (initial.scrollHeight <= initial.clientHeight) {
        throw new Error(
          `Chat scroll container is not overflowing: ${JSON.stringify(initial)}`,
        );
      }

      await browser.execute(() => {
        const scrollElement = document.querySelector<HTMLElement>(
          "[data-conversation-scroll='true']",
        );
        if (scrollElement) {
          scrollElement.scrollTop = 0;
        }
      });
      await browser.waitUntil(
        async () =>
          (await browser.execute(
            () =>
              document.querySelector<HTMLElement>(
                "[data-conversation-scroll='true']",
              )?.scrollTop ?? 0,
          )) === 0,
        {
          timeout: 5_000,
          timeoutMsg: "Chat scroll container did not return to top",
        },
      );

      const before = await browser.execute(() => ({
        scrollTop:
          document.querySelector<HTMLElement>(
            "[data-conversation-scroll='true']",
          )?.scrollTop ?? 0,
        minimapTop:
          document
            .querySelector<HTMLElement>("[aria-label='Conversation minimap']")
            ?.getBoundingClientRect().top ?? null,
        summaryTop:
          document
            .querySelector<HTMLElement>("[data-testid='thread-summary-panel']")
            ?.getBoundingClientRect().top ?? null,
      }));

      await browser.execute(() => {
        const scrollElement = document.querySelector<HTMLElement>(
          "[data-conversation-scroll='true']",
        );
        if (scrollElement) {
          scrollElement.scrollTop = Math.min(
            320,
            scrollElement.scrollHeight - scrollElement.clientHeight,
          );
        }
      });
      await browser.waitUntil(
        async () =>
          (await browser.execute(
            () =>
              document.querySelector<HTMLElement>(
                "[data-conversation-scroll='true']",
              )?.scrollTop ?? 0,
          )) > before.scrollTop,
        { timeout: 5_000, timeoutMsg: "Chat scrollTop did not advance" },
      );

      const after = await browser.execute(() => ({
        scrollTop:
          document.querySelector<HTMLElement>(
            "[data-conversation-scroll='true']",
          )?.scrollTop ?? 0,
        minimapTop:
          document
            .querySelector<HTMLElement>("[aria-label='Conversation minimap']")
            ?.getBoundingClientRect().top ?? null,
        summaryTop:
          document
            .querySelector<HTMLElement>("[data-testid='thread-summary-panel']")
            ?.getBoundingClientRect().top ?? null,
      }));

      if (
        before.minimapTop === null ||
        before.summaryTop === null ||
        after.minimapTop === null ||
        after.summaryTop === null ||
        Math.abs(after.minimapTop - before.minimapTop) > 1 ||
        Math.abs(after.summaryTop - before.summaryTop) > 1
      ) {
        throw new Error(
          `Side columns moved with chat scroll: ${JSON.stringify({ before, after })}`,
        );
      }

      await saveFixtureScreenshot("chat-scroll-after.png");
      await scroll.waitForDisplayed();
      await minimap.waitForDisplayed();
      await summary.waitForDisplayed();
    });
  });
});
