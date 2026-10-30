import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKETPLACE_PREFERENCES,
  addDisabledMarketplace,
  parseMarketplacePreferences,
  removeDisabledMarketplace,
} from "./marketplace-preferences";

describe("marketplace preferences", () => {
  it("parses disabled marketplace definitions and ignores malformed entries", () => {
    expect(
      parseMarketplacePreferences(
        JSON.stringify({
          version: 1,
          disabled: {
            community: {
              source: "https://example.com/community.git",
              refName: "main",
              sparsePaths: ["plugins/community"],
            },
            malformed: { source: 42 },
          },
        }),
      ),
    ).toEqual({
      version: 1,
      disabled: {
        community: {
          source: "https://example.com/community.git",
          refName: "main",
          sparsePaths: ["plugins/community"],
        },
      },
    });
  });

  it("adds and removes a disabled marketplace definition", () => {
    const disabled = addDisabledMarketplace(
      DEFAULT_MARKETPLACE_PREFERENCES,
      "community",
      {
        source: "/tmp/community",
        refName: "main",
        sparsePaths: [],
      },
    );

    expect(removeDisabledMarketplace(disabled, "community")).toEqual(
      DEFAULT_MARKETPLACE_PREFERENCES,
    );
  });
});
