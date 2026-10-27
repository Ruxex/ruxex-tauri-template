import { describe, expect, it } from "vitest";

import { TASK_STATUSES, taskStatusLabel } from "./task-status";

describe("task status", () => {
  it.each([
    ["running", "Running"],
    ["waiting", "Waiting"],
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["stopped", "Stopped"],
  ] as const)("labels %s as %s", (status, label) => {
    expect(taskStatusLabel(status)).toBe(label);
  });

  it("exposes only statuses supported by the initial task UI", () => {
    expect(TASK_STATUSES).toEqual([
      "running",
      "waiting",
      "completed",
      "failed",
      "stopped",
    ]);
  });
});
