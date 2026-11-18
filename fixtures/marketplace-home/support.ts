import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MARKETPLACE_SOURCE_RELATIVE_PATH = "../../openai-plugins";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function resolveMarketplaceSource(root: string = repositoryRoot): string {
  const resolved = path.resolve(root, MARKETPLACE_SOURCE_RELATIVE_PATH);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(`Marketplace checkout not found at resolved path: ${resolved}`);
  }
  return resolved;
}

export function marketplacePluginDetailPath(marketplaceName: string, pluginName: string): string {
  return `/capabilities/plugins/${encodeURIComponent(marketplaceName)}/${encodeURIComponent(pluginName)}`;
}

export async function openMarketplaceSettings(): Promise<void> {
  await browser.url("tauri://localhost/#/settings/marketplaces");
  await $("h2=Plugin marketplaces").waitForDisplayed({ timeout: 10_000 });
}

export async function openCapabilities(): Promise<void> {
  await browser.url("tauri://localhost/#/capabilities/plugins");
  await $("h1=Plugins").waitForDisplayed({ timeout: 10_000 });
}

export async function saveMarketplaceScreenshot(name: string): Promise<void> {
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
