import { describe, expect, it } from "vitest";
import type { v2 } from "../../protocol";

import {
  CHAT_STATUSES,
  chatStatusFromThreadStatus,
  chatStatusLabel,
} from "./chat-status";

describe("chat status", () => {
  it.each([
    ["running", "Running"],
    ["waiting", "Waiting"],
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["stopped", "Stopped"],
  ] as const)("labels %s as %s", (status, label) => {
    expect(chatStatusLabel(status)).toBe(label);
  });

  it("exposes only statuses supported by the initial chat UI", () => {
    expect(CHAT_STATUSES).toEqual([
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
    expect(chatStatusFromThreadStatus(status as v2.ThreadStatus)).toBe(expected);
  });
});
