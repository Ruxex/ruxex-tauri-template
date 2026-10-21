import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("worktree native bridge", () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue(undefined));

  it("uses structured argv-backed worktree commands", async () => {
    const { createWorktree, listWorktrees, openWorktree, removeWorktree } =
      await import("./worktrees");
    const request = {
      root: "/repo",
      destination: "/repo/.worktrees/feature",
      branch: "feature",
    };
    await listWorktrees("/repo");
    await createWorktree(request);
    await removeWorktree({
      ...request,
      path: request.destination,
      force: true,
    });
    await openWorktree("/repo", request.destination);

    expect(invoke).toHaveBeenNthCalledWith(1, "worktree_list", {
      root: "/repo",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "worktree_create", { request });
    expect(invoke).toHaveBeenNthCalledWith(3, "worktree_remove", {
      request: { ...request, path: request.destination, force: true },
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "worktree_open", {
      root: "/repo",
      path: request.destination,
    });
  });
});
