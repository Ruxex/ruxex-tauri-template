// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/app/i18n";
import type { CodeViewItem } from "@pierre/diffs";
import type { GitDiffFile } from "@/platform/git-diff";
import { GitDiffReviewPane } from "./GitDiffReviewPane";

const useGitDiffDetails = vi.hoisted(() => vi.fn());
const getGitDiffFilePatch = vi.hoisted(() => vi.fn());
vi.mock("@/platform/git-diff", () => ({
  useGitDiffDetails,
  gitDiffSummaryQueryKey: (workspace: string) => ["platform", "git-diff-summary", workspace],
  gitDiffFilePatchQueryKey: (workspace: string, path?: string) =>
    path === undefined
      ? ["platform", "git-diff-file-patch", workspace]
      : ["platform", "git-diff-file-patch", workspace, path],
  gitDiffFilePatchQueryOptions: (workspace: string, path: string) => ({
    queryKey: ["platform", "git-diff-file-patch", workspace, path],
    queryFn: () => getGitDiffFilePatch(workspace, path),
    retry: false,
  }),
}));
vi.mock("@/app/ui-preferences", () => ({
  getUiThemePresetMode: () => "light",
  useUiPreferences: () => ({ preferences: { theme: { preset: "light" } } }),
}));
vi.mock("@pierre/diffs/react", () => ({
  CodeView: ({
    items,
    renderCustomHeader,
  }: {
    items: CodeViewItem<undefined>[];
    renderCustomHeader: (item: CodeViewItem<undefined>) => ReactNode;
  }) => (
    <div data-testid="code-view">
      {items.map((item) => (
        <div data-collapsed={item.collapsed} data-testid={`diff-item-${item.id}`} key={item.id}>
          {renderCustomHeader(item)}
        </div>
      ))}
    </div>
  ),
}));

describe("GitDiffReviewPane", () => {
  afterEach(cleanup);

  beforeEach(() => {
    getGitDiffFilePatch.mockReset();
    useGitDiffDetails.mockReset();
    void i18n.changeLanguage("en");
  });

  function renderPane(files: GitDiffFile[]) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
    });
    const refetch = vi.fn().mockResolvedValue({ data: files });
    useGitDiffDetails.mockReturnValue({
      data: files,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    });
    render(
      <QueryClientProvider client={queryClient}>
        <GitDiffReviewPane target={{ threadId: "thread-1", workspace: "/workspace" }} isOpen />
      </QueryClientProvider>,
    );
    return { queryClient, refetch };
  }

  it.each([
    ["en", 1, "1 file"],
    ["en", 2, "2 files"],
    ["ja", 1, "ファイル 1 件"],
    ["ja", 2, "ファイル 2 件"],
  ] as const)("renders the %s file count for %i files", async (language, count, expected) => {
    await i18n.changeLanguage(language);
    const files: GitDiffFile[] = Array.from({ length: count }, (_, index) => ({
      path: `source-${index}.ts`,
      status: "modified",
      added: 1,
      deleted: 0,
      binary: false,
      patch: null,
    }));
    renderPane(files);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("fetches a file patch only after expanding that file", async () => {
    const files: GitDiffFile[] = [
      {
        path: "source-a.ts",
        status: "modified",
        added: 1,
        deleted: 1,
        binary: false,
        patch: null,
      },
      {
        path: "source-b.ts",
        status: "modified",
        added: 1,
        deleted: 1,
        binary: false,
        patch: null,
      },
    ];
    getGitDiffFilePatch.mockResolvedValue("diff --git a/source-a.ts b/source-a.ts\n");

    renderPane(files);

    expect(getGitDiffFilePatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Expand source-a.ts" }));
    await waitFor(() => expect(getGitDiffFilePatch).toHaveBeenCalledWith("/workspace", "source-a.ts"));
    expect(getGitDiffFilePatch).toHaveBeenCalledTimes(1);
  });

  it("keeps binary files expanded and non-interactive", () => {
    renderPane([
      {
        path: "image.png",
        status: "modified",
        added: 0,
        deleted: 0,
        binary: true,
        patch: null,
      },
    ]);

    expect(screen.getByTestId("diff-item-image.png").dataset.collapsed).toBe("false");
    expect(screen.getByText("Binary")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Expand image.png" })).toBeNull();
  });

  it("refreshes details and invalidates the summary and cached file patches", async () => {
    const files: GitDiffFile[] = [
      {
        path: "source.ts",
        status: "modified",
        added: 1,
        deleted: 1,
        binary: false,
        patch: null,
      },
    ];
    const { queryClient, refetch } = renderPane(files);
    queryClient.setQueryData(["platform", "git-diff-summary", "/workspace"], {
      added: 1,
      deleted: 1,
      files: 1,
    });
    queryClient.setQueryData(["platform", "git-diff-file-patch", "/workspace", "source.ts"], "old patch");

    fireEvent.click(screen.getByRole("button", { name: "Refresh diff" }));

    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    await waitFor(() => {
      expect(queryClient.getQueryState(["platform", "git-diff-summary", "/workspace"])?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState(["platform", "git-diff-file-patch", "/workspace", "source.ts"])?.isInvalidated,
      ).toBe(true);
    });
  });
});
