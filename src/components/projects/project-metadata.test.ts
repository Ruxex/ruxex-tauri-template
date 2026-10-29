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
    ).toEqual({ icon: "code", color: "violet" });
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
        { icon: "globe", color: "green" },
        { owner: "frontend", icon: "folder", type: "website" },
      ),
    ).toEqual({
      owner: "frontend",
      icon: "globe",
      color: "green",
    });
  });

  it("does not expose a project type in the GUI contract", () => {
    expect(DEFAULT_PROJECT_METADATA).toEqual({ icon: "folder", color: "blue" });
  });
});
