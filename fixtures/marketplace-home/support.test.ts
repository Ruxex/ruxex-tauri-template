import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MARKETPLACE_SOURCE_RELATIVE_PATH,
  marketplacePluginDetailPath,
  resolveMarketplaceSource,
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
});
