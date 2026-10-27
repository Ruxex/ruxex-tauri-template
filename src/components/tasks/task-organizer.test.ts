import { describe, expect, it } from "vitest";

import { organizeTasks } from "./task-organizer";

function task(
  id: string,
  overrides: Partial<Parameters<typeof organizeTasks>[0][number]> = {},
) {
  return {
    id,
    name: id,
    preview: id,
    status: { type: "idle" as const },
    updatedAt: 10,
    ...overrides,
  };
}

describe("organizeTasks", () => {
  it("groups pinned, active, recent, and archived tasks without provider data", () => {
    const result = organizeTasks([
      task("pinned", { pinned: true }),
      task("running", {
        liveStatus: "running",
        updatedAt: 20,
      }),
      task("recent", { updatedAt: 15 }),
      task("archived", { archived: true }),
    ]);

    expect(result.pinned.map((item) => item.id)).toEqual(["pinned"]);
    expect(result.active.map((item) => item.id)).toEqual(["running"]);
    expect(result.recent.map((item) => item.id)).toEqual(["recent"]);
    expect(result.archived.map((item) => item.id)).toEqual(["archived"]);
    expect(JSON.stringify(result)).not.toContain("model");
  });

  it("uses the task status selector for approval and user-input waiting", () => {
    const result = organizeTasks([
      task("waiting", {
        status: { type: "active", activeFlags: ["waitingOnApproval"] },
      }),
    ]);

    expect(result.active.map((item) => item.id)).toEqual(["waiting"]);
  });
});
