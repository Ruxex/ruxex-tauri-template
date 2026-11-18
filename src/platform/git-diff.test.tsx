// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../app-server/runtime", () => ({ isDesktopRuntime: true }));

import { useGitDiffDetails, useGitDiffSummary } from "./git-diff";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("Git diff queries", () => {
  beforeEach(() => invoke.mockReset());
  afterEach(cleanup);

  it("fetches summary and detail data for an enabled workspace", async () => {
    const summary = { added: 4, deleted: 2, files: 1 };
    const details = [
      {
        path: "src/app.ts",
        status: "modified",
        added: 4,
        deleted: 2,
        binary: false,
        patch: "@@ diff @@",
      },
    ];
    invoke.mockResolvedValueOnce(summary).mockResolvedValueOnce(details);
    const wrapper = createWrapper();
    const summaryQuery = renderHook(() => useGitDiffSummary("/workspace"), {
      wrapper,
    });
    await waitFor(() =>
      expect(summaryQuery.result.current.data).toEqual(summary),
    );
    const detailQuery = renderHook(
      () => useGitDiffDetails("/workspace", true),
      { wrapper },
    );
    await waitFor(() =>
      expect(detailQuery.result.current.data).toEqual(details),
    );

    expect(invoke.mock.calls).toEqual([
      ["git_diff_summary", { workspace: "/workspace" }],
      ["git_diff_details", { workspace: "/workspace" }],
    ]);
    summaryQuery.unmount();
    detailQuery.unmount();
  });

  it("does not request data without a workspace or when detail loading is off", () => {
    const wrapper = createWrapper();
    const summary = renderHook(() => useGitDiffSummary(null), { wrapper });
    const details = renderHook(() => useGitDiffDetails("/workspace", false), {
      wrapper,
    });

    expect(summary.result.current.fetchStatus).toBe("idle");
    expect(details.result.current.fetchStatus).toBe("idle");
    expect(invoke).not.toHaveBeenCalled();
  });
});
