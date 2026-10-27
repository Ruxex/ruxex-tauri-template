import { describe, expect, it } from "vitest";
import type { v2 } from "../../protocol";

import {
  TASK_STATUSES,
  taskStatusFromThreadStatus,
  taskStatusLabel,
} from "./task-status";

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

  it.each([
    [{ type: "active", activeFlags: [] }, "running"],
    [{ type: "active", activeFlags: ["waitingOnApproval"] }, "waiting"],
    [{ type: "active", activeFlags: ["waitingOnUserInput"] }, "waiting"],
    [{ type: "systemError" }, "failed"],
    [{ type: "idle" }, undefined],
  ] as const)("maps thread status %o to %s", (status, expected) => {
    expect(taskStatusFromThreadStatus(status as v2.ThreadStatus)).toBe(expected);
  });
});
