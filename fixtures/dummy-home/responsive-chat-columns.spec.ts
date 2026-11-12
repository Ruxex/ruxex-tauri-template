import {
  sendMinimapConversation,
  saveFixtureScreenshot,
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

describe("Responsive chat columns", () => {
  before(async () => {
    await waitForDesktopReady();
    await openFixtureThread();
    await sendMinimapConversation();
  });

  for (const width of [
    800, 1000, 1200, 1360, 1450, 1550, 1600, 1650, 1680, 1920, 2240, 2400,
  ]) {
    it(`captures the chat columns at ${width}px`, async () => {
      await withWindowSize(width, 800, async () => {
        await browser.pause(250);
        const main = $("main.chat-main-column");
        const workspace = $("[data-testid='chat-workspace']");
        const minimapRect = await browser.execute((selector) => {
          const rect = document
            .querySelector(selector)
            ?.getBoundingClientRect();
          if (!rect) throw new Error(`Missing element: ${selector}`);
          return { x: rect.x, width: rect.width, height: rect.height };
        }, "[aria-label='Conversation minimap']");
        const summaryRect = await browser.execute((selector) => {
          const rect = document
            .querySelector(selector)
            ?.getBoundingClientRect();
          if (!rect) throw new Error(`Missing element: ${selector}`);
          return { x: rect.x, width: rect.width, height: rect.height };
        }, "[data-testid='thread-summary-panel']");
        const mainSize = await main.getSize();
        const workspaceRect = await workspace.getLocation();
        const workspaceSize = await workspace.getSize();
        const layoutInfo = await browser.execute(() => {
          const workspaceElement = document.querySelector(
            "[data-testid='chat-workspace']",
          );
          const containerElement = document.querySelector(
            "[data-testid='chat-content-container']",
          );
          return {
            grid: workspaceElement
              ? getComputedStyle(workspaceElement).gridTemplateColumns
              : null,
            containerWidth:
              containerElement?.getBoundingClientRect().width ?? null,
            containerType: containerElement
              ? getComputedStyle(containerElement).containerType
              : null,
            containerName: containerElement
              ? getComputedStyle(containerElement).containerName
              : null,
          };
        });
        const minimapVisible = minimapRect.width > 0;
        const summaryVisible = summaryRect.width > 0;
        const expectedLayout =
          workspaceSize.width < 1024
            ? "chat-only"
            : workspaceSize.width < 1280
              ? "minimap-chat"
              : workspaceSize.width < 1536
                ? "chat-summary"
                : "all-columns";
        const gridColumnWidths =
          layoutInfo.grid
            .match(/[\d.]+px/g)
            ?.map((value) => Number.parseFloat(value)) ?? [];
        const minimapColumnWidth = gridColumnWidths[0] ?? 0;
        const summaryColumnWidth = gridColumnWidths[2] ?? 0;
        const expectedMinimap =
          (expectedLayout === "minimap-chat" ||
            expectedLayout === "all-columns") &&
          minimapColumnWidth >= 64;
        const expectedSummary =
          (expectedLayout === "chat-summary" ||
            expectedLayout === "all-columns") &&
          summaryColumnWidth >= 256;
        if (
          minimapVisible !== expectedMinimap ||
          summaryVisible !== expectedSummary
        ) {
          throw new Error(
            `Unexpected responsive columns at ${width}px for ${expectedLayout}: minimap=${minimapVisible} (${JSON.stringify(minimapRect)}), summary=${summaryVisible} (${JSON.stringify(summaryRect)}), layout=${JSON.stringify({ ...layoutInfo, minimapColumnWidth, summaryColumnWidth })}`,
          );
        }
        if (mainSize.width > 848) {
          throw new Error(
            `Main chat exceeded 53rem at ${width}px: ${mainSize.width}px`,
          );
        }
        if (
          summaryVisible &&
          (summaryRect.x < workspaceRect.x ||
            summaryRect.x + summaryRect.width >
              workspaceRect.x + workspaceSize.width)
        ) {
          throw new Error(
            `Thread Summary escaped the workspace at ${width}px: ${JSON.stringify({ summaryRect, summarySize, workspaceRect, workspaceSize })}`,
          );
        }
        console.info(
          JSON.stringify({
            width,
            workspaceWidth: workspaceSize.width,
            minimapVisible,
            summaryVisible,
            mainWidth: mainSize.width,
          }),
        );
        await saveFixtureScreenshot(`responsive-chat-${width}.png`);
      });
    });
  }
});
