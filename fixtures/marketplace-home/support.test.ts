import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  MARKETPLACE_SOURCE_RELATIVE_PATH,
  marketplacePluginDetailPath,
  resolveMarketplaceSource,
  saveMarketplaceScreenshot,
} from "./support";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("marketplace fixture source resolution", () => {
  it("keeps the checked-in source path relative", () => {
    expect(path.isAbsolute(MARKETPLACE_SOURCE_RELATIVE_PATH)).toBe(false);
  });

  it("resolves the sibling checkout from the repository root", () => {
    const expected = path.resolve(
      repositoryRoot,
      MARKETPLACE_SOURCE_RELATIVE_PATH,
    );

    expect(resolveMarketplaceSource(repositoryRoot)).toBe(expected);
    expect(existsSync(expected)).toBe(true);
  });

  it("reports the resolved path when the sibling checkout is missing", () => {
    const missingRoot = path.join(repositoryRoot, ".missing-marketplace-root");
    const expected = path.resolve(
      missingRoot,
      MARKETPLACE_SOURCE_RELATIVE_PATH,
    );

    expect(() => resolveMarketplaceSource(missingRoot)).toThrow(expected);
  });
});

describe("marketplace fixture routes", () => {
  it("builds an encoded plugin detail route", () => {
    expect(
      marketplacePluginDetailPath("openai-curated", "build-web-apps"),
    ).toBe("/capabilities/plugins/openai-curated/build-web-apps");
  });

  it("waits 300ms before and after saving a marketplace screenshot", async () => {
    const pause = vi.fn(async () => undefined);
    const saveScreenshot = vi.fn(async () => undefined);
    vi.stubGlobal("browser", { pause, saveScreenshot });

    try {
      await saveMarketplaceScreenshot("stability.png");

      expect(pause).toHaveBeenNthCalledWith(1, 300);
      expect(pause).toHaveBeenNthCalledWith(2, 300);
      expect(pause).toHaveBeenCalledTimes(2);
      expect(saveScreenshot).toHaveBeenCalledTimes(1);
      expect(pause.mock.invocationCallOrder[0]).toBeLessThan(
        saveScreenshot.mock.invocationCallOrder[0],
      );
      expect(pause.mock.invocationCallOrder[1]).toBeGreaterThan(
        saveScreenshot.mock.invocationCallOrder[0],
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
