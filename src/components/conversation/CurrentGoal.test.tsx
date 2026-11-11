// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useThreadGoal = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({ useThreadGoal }));

describe("CurrentGoal", () => {
  afterEach(cleanup);

  it("shows the current goal above the composer on the left", async () => {
    useThreadGoal.mockReturnValue({
      data: {
        goal: {
          threadId: "thread-1",
          objective: "Ship the chat redesign",
          status: "active",
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    });

    const { CurrentGoal } = await import("./CurrentGoal");
    render(<CurrentGoal threadId="thread-1" />);

    const goal = screen.getByRole("region", { name: "Current goal" });
    expect(goal.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "justify-start"]),
    );
    expect(screen.getByText("Ship the chat redesign")).toBeTruthy();
  });

  it("does not render when no goal is set", async () => {
    useThreadGoal.mockReturnValue({ data: { goal: null } });

    const { CurrentGoal } = await import("./CurrentGoal");
    render(<CurrentGoal threadId="thread-1" />);

    expect(screen.queryByRole("region", { name: "Current goal" })).toBeNull();
  });

  it("does not render a completed goal", async () => {
    useThreadGoal.mockReturnValue({
      data: {
        goal: {
          threadId: "thread-1",
          objective: "Ship the chat redesign",
          status: "complete",
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 0,
          updatedAt: 1,
        },
      },
    });

    const { CurrentGoal } = await import("./CurrentGoal");
    render(<CurrentGoal threadId="thread-1" />);

    expect(screen.queryByRole("region", { name: "Current goal" })).toBeNull();
  });
});
