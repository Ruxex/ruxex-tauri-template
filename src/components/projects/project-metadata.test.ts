import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_METADATA,
  parseProjectMetadata,
  projectMetadataToRecord,
} from "./project-metadata";

describe("project metadata", () => {
  it("parses the GUI project identity contract", () => {
    expect(
      parseProjectMetadata({
        icon: "code",
        type: "library",
        color: "violet",
      }),
    ).toEqual({ icon: "code", type: "library", color: "violet" });
  });

  it("falls back independently when metadata values are invalid", () => {
    expect(
      parseProjectMetadata({
        icon: "unknown-icon",
        type: 42,
        color: "unknown-color",
      }),
    ).toEqual(DEFAULT_PROJECT_METADATA);
  });

  it("preserves unrelated metadata when serializing GUI fields", () => {
    expect(
      projectMetadataToRecord(
        { icon: "globe", type: "website", color: "green" },
        { owner: "frontend", icon: "folder" },
      ),
    ).toEqual({
      owner: "frontend",
      icon: "globe",
      type: "website",
      color: "green",
    });
  });
});
