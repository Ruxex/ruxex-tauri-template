import { describe, expect, it } from "vitest";

import {
  normalizeDeepLink,
  validateScheduleSpec,
  validateWorktreePath,
} from "./platform-model";

describe("platform model boundaries", () => {
  it("accepts only known ruxex deep-link targets", () => {
    expect(normalizeDeepLink("ruxex://thread/thread-1")).toEqual({
      kind: "thread",
      id: "thread-1",
    });
    expect(normalizeDeepLink("ruxex://project/project-1")).toEqual({
      kind: "project",
      id: "project-1",
    });
    expect(normalizeDeepLink("https://thread/thread-1")).toBeNull();
    expect(normalizeDeepLink("ruxex://thread/../etc")).toBeNull();
  });

  it("validates one-shot and recurring schedule definitions", () => {
    expect(
      validateScheduleSpec({
        name: "nightly",
        prompt: "run checks",
        cadence: { kind: "daily", hour: 2, minute: 30 },
      }),
    ).toBe(true);
    expect(
      validateScheduleSpec({
        name: "bad",
        prompt: "",
        cadence: { kind: "daily", hour: 25, minute: 0 },
      }),
    ).toBe(false);
    expect(
      validateScheduleSpec({
        name: "twice-weekly",
        prompt: "run checks",
        cadence: { kind: "weekly", weekdays: [2, 4], hour: 15, minute: 0 },
      }),
    ).toBe(true);
    expect(
      validateScheduleSpec({
        name: "no-days",
        prompt: "run checks",
        cadence: { kind: "weekly", weekdays: [], hour: 15, minute: 0 },
      }),
    ).toBe(false);
  });

  it("keeps worktree destinations inside the selected workspace root", () => {
    expect(
      validateWorktreePath("/workspace/repo", "/workspace/repo/.worktrees/a"),
    ).toBe(true);
    expect(validateWorktreePath("/workspace/repo", "/workspace/other")).toBe(
      false,
    );
    expect(
      validateWorktreePath("/workspace/repo", "/workspace/repo/../other"),
    ).toBe(false);
  });
});
