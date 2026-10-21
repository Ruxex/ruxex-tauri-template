// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useWorktrees = vi.hoisted(() => vi.fn());
vi.mock("../../app-server/hooks", () => ({ useWorktrees }));

describe("WorktreeCard", () => {
  afterEach(cleanup);
  beforeEach(() => {
    useWorktrees.mockReturnValue({
      query: {
        data: [
          {
            path: "/repo/.worktrees/feature",
            branch: "feature",
            commit: "abc",
            clean: false,
            locked: false,
            prunable: false,
          },
        ],
        isLoading: false,
        isError: false,
      },
      create: { mutate: vi.fn(), isPending: false },
      remove: { mutate: vi.fn(), isPending: false },
      open: { mutate: vi.fn(), isPending: false },
    });
  });

  it("shows dirty worktrees and requires an explicit force checkbox", async () => {
    const { WorktreeCard } = await import("./WorktreeCard");
    render(<WorktreeCard root="/repo" />);
    expect(screen.getByText("feature")).toBeTruthy();
    expect(screen.getByText("Dirty")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove feature" }));
    const worktree = useWorktrees.mock.results[0]?.value;
    expect(worktree.remove.mutate).toHaveBeenCalledWith({
      path: "/repo/.worktrees/feature",
      force: false,
    });
  });

  it("creates a validated branch destination and opens a worktree", async () => {
    const { WorktreeCard } = await import("./WorktreeCard");
    render(<WorktreeCard root="/repo" />);
    fireEvent.change(screen.getByLabelText("Worktree branch"), {
      target: { value: "new-feature" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create worktree" }));
    fireEvent.click(screen.getByRole("button", { name: "Open feature" }));
    const worktree = useWorktrees.mock.results[0]?.value;
    expect(worktree.create.mutate).toHaveBeenCalledWith({
      root: "/repo",
      branch: "new-feature",
      destination: "/repo/.worktrees/new-feature",
    });
    expect(worktree.open.mutate).toHaveBeenCalledWith(
      "/repo/.worktrees/feature",
    );
  });
});
