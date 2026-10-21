// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWorktrees = vi.hoisted(() => vi.fn());
const createWorktree = vi.hoisted(() => vi.fn());
const removeWorktree = vi.hoisted(() => vi.fn());
const openWorktree = vi.hoisted(() => vi.fn());

vi.mock("../../platform/worktrees", () => ({
  listWorktrees,
  createWorktree,
  removeWorktree,
  openWorktree,
}));
vi.mock("../runtime", () => ({ isDesktopRuntime: true }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );
}

describe("useWorktrees", () => {
  beforeEach(() => {
    listWorktrees.mockReset().mockResolvedValue([]);
    createWorktree
      .mockReset()
      .mockResolvedValue({ path: "/repo/.worktrees/a" });
    removeWorktree.mockReset().mockResolvedValue(undefined);
    openWorktree.mockReset().mockResolvedValue(undefined);
  });

  it("loads the repository and maps create/open/remove mutations", async () => {
    const { useWorktrees } = await import("./useWorktrees");
    const { result } = renderHook(() => useWorktrees("/repo"), { wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({
        root: "/repo",
        destination: "/repo/.worktrees/a",
        branch: "a",
      });
      await result.current.open.mutateAsync("/repo/.worktrees/a");
      await result.current.remove.mutateAsync({
        path: "/repo/.worktrees/a",
        force: true,
      });
    });
    expect(createWorktree).toHaveBeenCalledOnce();
    expect(openWorktree).toHaveBeenCalledWith("/repo", "/repo/.worktrees/a");
    expect(removeWorktree.mock.calls[0]?.[0]).toMatchObject({
      path: "/repo/.worktrees/a",
      force: true,
    });
  });
});
