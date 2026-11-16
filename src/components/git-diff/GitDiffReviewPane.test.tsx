// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../app/i18n";
import type { GitDiffFile } from "../../platform/git-diff";
import { GitDiffReviewPane } from "./GitDiffReviewPane";

const useGitDiffDetails = vi.hoisted(() => vi.fn());
vi.mock("../../platform/git-diff", () => ({ useGitDiffDetails }));
vi.mock("../../app/ui-preferences", () => ({
  getUiThemePresetMode: () => "light",
  useUiPreferences: () => ({ preferences: { theme: { preset: "light" } } }),
}));
vi.mock("@pierre/diffs/react", () => ({ CodeView: () => null }));

describe("GitDiffReviewPane", () => {
  afterEach(cleanup);

  it.each([
    ["en", 1, "1 file"],
    ["en", 2, "2 files"],
    ["ja", 1, "ファイル 1 件"],
    ["ja", 2, "ファイル 2 件"],
  ] as const)(
    "renders the %s file count for %i files",
    async (language, count, expected) => {
      await i18n.changeLanguage(language);
      const files: GitDiffFile[] = Array.from(
        { length: count },
        (_, index) => ({
          path: `/workspace/source-${index}.ts`,
          status: "modified",
          added: 1,
          deleted: 0,
          binary: false,
          patch: null,
        }),
      );
      useGitDiffDetails.mockReturnValue({
        data: files,
        isLoading: false,
        isError: false,
      });
      render(
        <GitDiffReviewPane
          target={{ threadId: "thread-1", workspace: "/workspace" }}
          isOpen
        />,
      );
      expect(screen.getByText(expected)).toBeTruthy();
    },
  );
});
