import { describe, expect, it } from "vitest";

import type { v2 } from "../../protocol";
import { projectRootSummary } from "./project-context-model";

function project(roots: string[]): v2.Project {
  return {
    id: "project-1",
    name: "Test project",
    roots: roots.map((path) => ({ path })),
    metadata: {},
    position: 0,
    createdAt: 0,
    updatedAt: 0,
    recencyAt: null,
  };
}

describe("project context model", () => {
  it("explains when a project has no workspace roots", () => {
    expect(projectRootSummary(project([]))).toBe(
      "No workspace roots configured.",
    );
  });

  it("preserves the server-provided root order", () => {
    expect(
      projectRootSummary(project(["/workspace/app", "/workspace/docs"])),
    ).toBe("/workspace/app\n/workspace/docs");
  });
});
