import {
  openCapabilities,
  openMarketplaceSettings,
  resolveMarketplaceSource,
  saveMarketplaceScreenshot,
} from "./support";

const MARKETPLACE_NAME = "openai-curated";

describe("real plugin marketplace home", () => {
  it("creates empty, uninstalled, and installed plugin states", async () => {
    await waitForMarketplaceDesktopReady();

    await openCapabilities();
    await $("h3=No plugin marketplaces yet").waitForDisplayed({
      timeout: 10_000,
    });
    await saveMarketplaceScreenshot("marketplace-empty.png");

    await openMarketplaceSettings();
    const sourceInput = $("input[aria-label='Source']");
    await sourceInput.setValue(resolveMarketplaceSource());
    await $("button[aria-label='Add marketplace']").click();
    await browser.waitUntil(
      async () => {
        if ((await sourceInput.getValue()) === "") {
          return true;
        }
        const pageText = await $("main").getText();
        if (pageText.includes("Unable to add marketplace:")) {
          throw new Error(`Marketplace add failed: ${pageText}`);
        }
        return false;
      },
      {
        timeout: 30_000,
        timeoutMsg: "The marketplace add mutation should finish successfully",
      },
    );

    await openCapabilities();
    const marketplace = $("[data-testid='plugin-marketplace']");
    await marketplace.waitForDisplayed({ timeout: 30_000 });
    await browser.waitUntil(
      async () => {
        const text = await marketplace.getText();
        return (
          text.includes("Codex official") &&
          text.includes(MARKETPLACE_NAME) &&
          text.includes("plugins")
        );
      },
      {
        timeout: 30_000,
        timeoutMsg: `Expected ${MARKETPLACE_NAME} to load from the real checkout`,
      },
    );
    await $("a[aria-label='View details for Notion']").waitForDisplayed({
      timeout: 30_000,
    });
    await saveMarketplaceScreenshot("marketplace-list.png");

    await $("a[aria-label='View details for Notion']").click();
    await $("h1=Notion").waitForDisplayed({ timeout: 10_000 });
    await $("h2=Information").waitForDisplayed({ timeout: 10_000 });
    const notionInstall = $("button[aria-label='Install Notion']");
    await notionInstall.waitForDisplayed({ timeout: 10_000 });
    if (await notionInstall.isEnabled()) {
      throw new Error("Remote-only Notion should not be installable here");
    }
    await saveMarketplaceScreenshot("marketplace-notion-detail.png");

    await openCapabilities();
    await $("button[aria-label='Install Build Web Apps']").click();
    const installedButton = $("button[aria-label='Uninstall Build Web Apps']");
    await installedButton.waitForDisplayed({
      timeout: 30_000,
    });
    await installedButton.scrollIntoView({ block: "center" });
    await saveMarketplaceScreenshot("marketplace-installed-list.png");

    await $("a[aria-label='View details for Build Web Apps']").click();
    const buildWebAppsHeading = $("h1=Build Web Apps");
    await buildWebAppsHeading.waitForDisplayed({ timeout: 10_000 });
    await buildWebAppsHeading.scrollIntoView({ block: "start" });
    await $("h2=Skills").waitForDisplayed({ timeout: 10_000 });
    await $("h2=Information").waitForDisplayed({ timeout: 10_000 });
    await $("button[aria-label='Uninstall Build Web Apps']").waitForDisplayed({
      timeout: 10_000,
    });
    if (
      await $("button[aria-label='Install Build Web Apps']").isDisplayed()
    ) {
      throw new Error("Installed plugin should not show its install action");
    }
    await saveMarketplaceScreenshot("marketplace-build-web-apps-detail.png");

    const capabilitiesSidebar = $("aside[aria-label='Capabilities sidebar']");
    if (!(await capabilitiesSidebar.isDisplayed().catch(() => false))) {
      await $(
        "nav[aria-label='Workspace navigation'] button[aria-label='Plugins']",
      ).click();
    }
    await capabilitiesSidebar.waitForDisplayed({ timeout: 10_000 });
    await capabilitiesSidebar.$("summary").click();
    await capabilitiesSidebar
      .$("button[aria-label='Build Web Apps']")
      .waitForDisplayed({ timeout: 10_000 });
    if (
      await capabilitiesSidebar.$("button[aria-label='Notion']").isExisting()
    ) {
      throw new Error("Notion should remain uninstalled in the fixture");
    }
    await capabilitiesSidebar
      .$("button[aria-label='Build Web Apps']")
      .waitForDisplayed({ timeout: 10_000 });
  });
});

async function waitForMarketplaceDesktopReady(): Promise<void> {
  await $("main").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => {
      const text = (await $("main").getText()).toLowerCase();
      return (
        text.includes("modelabc") &&
        !text.includes("app-server is not connected")
      );
    },
    {
      timeout: 30_000,
      timeoutMsg: "The desktop App Server should be ready",
    },
  );
}
