import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MARKETPLACE_SOURCE_RELATIVE_PATH = "../../openai-plugins";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function resolveMarketplaceSource(
  root: string = repositoryRoot,
): string {
  const resolved = path.resolve(root, MARKETPLACE_SOURCE_RELATIVE_PATH);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(
      `Marketplace checkout not found at resolved path: ${resolved}`,
    );
  }
  return resolved;
}

export function marketplacePluginDetailPath(
  marketplaceName: string,
  pluginName: string,
): string {
  return `/capabilities/plugins/${encodeURIComponent(marketplaceName)}/${encodeURIComponent(pluginName)}`;
}

export async function openMarketplaceSettings(): Promise<void> {
  await browser.url("tauri://localhost/#/settings/marketplaces");
  await $("h2=Plugin marketplaces").waitForDisplayed({ timeout: 10_000 });
}

export async function openCapabilities(): Promise<void> {
  await browser.url("tauri://localhost/#/capabilities");
  await $("h1=Plugins").waitForDisplayed({ timeout: 10_000 });
}

export async function openPluginDetail(
  marketplaceName: string,
  pluginName: string,
): Promise<void> {
  await browser.url(
    `tauri://localhost/#${marketplacePluginDetailPath(marketplaceName, pluginName)}`,
  );
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes("/capabilities/plugins/"),
    {
      timeout: 10_000,
      timeoutMsg: `Plugin detail route did not open for ${marketplaceName}/${pluginName}`,
    },
  );
}

export async function saveMarketplaceScreenshot(name: string): Promise<void> {
  const artifactDirectory = process.env.RUXEX_E2E_ARTIFACTS ?? "artifacts";
  mkdirSync(artifactDirectory, { recursive: true });
  await browser.saveScreenshot(path.join(artifactDirectory, name));
}
