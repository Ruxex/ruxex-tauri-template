import { useMemo, useState } from "react";
import { CodeView } from "@pierre/diffs/react";
import type { CodeViewItem } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";

import {
  getUiThemePresetMode,
  useUiPreferences,
} from "../../app/ui-preferences";
import { useGitDiffDetails, type GitDiffFile } from "../../platform/git-diff";

export type GitDiffReviewTarget = {
  threadId: string;
  workspace: string;
};

type FileDisclosure = { collapsed: boolean; version: number };

export function GitDiffReviewPane({
  target,
  isOpen,
}: {
  target: GitDiffReviewTarget;
  isOpen: boolean;
}) {
  const query = useGitDiffDetails(target.workspace, isOpen);
  const { preferences } = useUiPreferences();
  const [disclosures, setDisclosures] = useState<
    Record<string, FileDisclosure>
  >({});

  const files = query.data ?? [];
  const themeType = useMemo(() => {
    const mode = getUiThemePresetMode(preferences.theme.preset ?? "system");
    if (mode !== "system") return mode;
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [preferences.theme.preset]);
  const diffOptions = useMemo(
    () => ({
      diffStyle: "unified" as const,
      theme: { light: "github-light", dark: "github-dark" },
      themeType,
    }),
    [themeType],
  );
  const fileByPath = useMemo(
    () => new Map(files.map((file) => [file.path, file])),
    [files],
  );
  const items = useMemo<CodeViewItem<undefined>[]>(() => {
    const result: CodeViewItem<undefined>[] = [];
    for (const file of files) {
      const state = disclosures[file.path] ?? { collapsed: false, version: 0 };
      const parsed = file.patch
        ? parsePatchFiles(file.patch).flatMap((patch) => patch.files)
        : [];
      const fileDiff = parsed[0];
      if (fileDiff) {
        result.push({
          id: file.path,
          type: "diff",
          fileDiff,
          collapsed: state.collapsed,
          version: state.version,
        });
      } else {
        result.push({
          id: file.path,
          type: "file",
          file: { name: file.path, contents: "" },
          collapsed: state.collapsed,
          version: state.version,
        });
      }
    }
    return result;
  }, [disclosures, files]);

  function toggleFile(path: string) {
    setDisclosures((current) => {
      const previous = current[path] ?? { collapsed: false, version: 0 };
      return {
        ...current,
        [path]: {
          collapsed: !previous.collapsed,
          version: previous.version + 1,
        },
      };
    });
  }

  return (
    <section aria-label="Code changes" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-base-300 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Code Changes</h2>
          {query.data && (
            <span className="text-xs text-base-content/60">
              {files.length} {files.length === 1 ? "file" : "files"}
              <span className="ml-2 font-medium text-success">
                +{sum(files, "added")}
              </span>
              <span className="ml-1 font-medium text-error">
                −{sum(files, "deleted")}
              </span>
            </span>
          )}
        </div>
      </header>

      {query.isLoading && (
        <div
          className="flex flex-1 items-center justify-center text-sm text-base-content/60"
          role="status"
        >
          Loading diff…
        </div>
      )}
      {query.isError && (
        <div className="p-4 text-sm text-error" role="alert">
          Unable to load Git diff.
        </div>
      )}
      {query.data?.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
          No changes
        </div>
      )}
      {query.data && query.data.length > 0 && (
        <CodeView
          className="min-h-0 flex-1"
          items={items}
          renderCustomHeader={(item) => {
            const file = fileByPath.get(item.id);
            if (!file) return null;
            return (
              <button
                aria-expanded={!item.collapsed}
                aria-label={`${item.collapsed ? "Expand" : "Collapse"} ${file.path}`}
                className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-base-200"
                onClick={() => toggleFile(file.path)}
                type="button"
              >
                <span aria-hidden="true" className="w-3 text-base-content/60">
                  {item.collapsed ? "›" : "⌄"}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono"
                  title={file.path}
                >
                  {file.path}
                </span>
                <span className="shrink-0 text-base-content/50">
                  {statusLabel(file)}
                </span>
                {file.binary ? (
                  <span className="shrink-0 text-base-content/50">Binary</span>
                ) : (
                  <span className="shrink-0 tabular-nums">
                    <span className="text-success">+{file.added}</span>
                    <span className="ml-1 text-error">−{file.deleted}</span>
                  </span>
                )}
              </button>
            );
          }}
          options={diffOptions}
        />
      )}
    </section>
  );
}

function sum(files: GitDiffFile[], key: "added" | "deleted") {
  return files.reduce((total, file) => total + file[key], 0);
}

function statusLabel(file: GitDiffFile) {
  switch (file.status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "typeChanged":
      return "T";
    default:
      return "M";
  }
}
