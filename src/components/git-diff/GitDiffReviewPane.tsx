import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { CodeView } from "@pierre/diffs/react";
import type { CodeViewItem } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";

import {
  getUiThemePresetMode,
  useUiPreferences,
} from "../../app/ui-preferences";
import {
  gitDiffFilePatchQueryKey,
  gitDiffFilePatchQueryOptions,
  gitDiffSummaryQueryKey,
  useGitDiffDetails,
  type GitDiffFile,
} from "../../platform/git-diff";

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
  const { t } = useTranslation("capabilities");
  const query = useGitDiffDetails(target.workspace, isOpen);
  const queryClient = useQueryClient();
  const { preferences } = useUiPreferences();
  const [disclosures, setDisclosures] = useState<
    Record<string, FileDisclosure>
  >({});

  const files = query.data ?? [];
  const expandedFiles = useMemo(
    () =>
      files.filter(
        (file) => !file.binary && !(disclosures[file.path]?.collapsed ?? true),
      ),
    [disclosures, files],
  );
  const filePatchQueries = useQueries({
    queries: expandedFiles.map((file) => ({
      ...gitDiffFilePatchQueryOptions(target.workspace, file.path),
      select: parseFilePatch,
    })),
  });
  const filePatchQueryByPath = useMemo(() => {
    const result = new Map<string, (typeof filePatchQueries)[number]>();
    expandedFiles.forEach((file, index) => {
      result.set(file.path, filePatchQueries[index]);
    });
    return result;
  }, [expandedFiles, filePatchQueries]);
  const isRefreshing =
    query.isFetching ||
    filePatchQueries.some((patchQuery) => patchQuery.isFetching);
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
      const state = disclosures[file.path] ?? { collapsed: true, version: 0 };
      const patchQuery = filePatchQueryByPath.get(file.path);
      const fileDiff = patchQuery?.data;
      const version = state.version + (patchQuery?.dataUpdatedAt ?? 0);
      if (fileDiff) {
        result.push({
          id: file.path,
          type: "diff",
          fileDiff,
          collapsed: state.collapsed,
          version,
        });
      } else {
        result.push({
          id: file.path,
          type: "file",
          file: { name: file.path, contents: "" },
          collapsed: file.binary || state.collapsed,
          version,
        });
      }
    }
    return result;
  }, [disclosures, filePatchQueryByPath, files]);

  async function refreshDiff() {
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({
        queryKey: gitDiffSummaryQueryKey(target.workspace),
      }),
      queryClient.invalidateQueries({
        queryKey: gitDiffFilePatchQueryKey(target.workspace),
      }),
    ]);
  }

  function toggleFile(path: string) {
    setDisclosures((current) => {
      const previous = current[path] ?? { collapsed: true, version: 0 };
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
    <section
      aria-label={t("codeChanges")}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-base-300 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("codeChanges")}</h2>
          <div className="flex min-w-0 items-center gap-2">
            {query.data && (
              <span className="truncate text-xs text-base-content/60">
                {t("diffFileCount", { count: files.length })}
                <span className="ml-2 font-medium text-success">
                  +{sum(files, "added")}
                </span>
                <span className="ml-1 font-medium text-error">
                  −{sum(files, "deleted")}
                </span>
              </span>
            )}
            <button
              aria-label={t("refreshDiff")}
              className="btn btn-ghost btn-sm btn-square shrink-0"
              disabled={!isOpen || isRefreshing}
              onClick={() => void refreshDiff()}
              title={t("refreshDiff")}
              type="button"
            >
              <ArrowPathIcon
                aria-hidden="true"
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {query.isLoading && (
        <div
          className="flex flex-1 items-center justify-center text-sm text-base-content/60"
          role="status"
        >
          {t("loadingDiff")}
        </div>
      )}
      {query.isError && (
        <div className="p-4 text-sm text-error" role="alert">
          {t("unableToLoadGitDiff")}
        </div>
      )}
      {query.data?.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
          {t("noChanges")}
        </div>
      )}
      {query.data && query.data.length > 0 && (
        <CodeView
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          items={items}
          renderCustomHeader={(item) => {
            const file = fileByPath.get(item.id);
            if (!file) return null;
            const patchQuery = filePatchQueryByPath.get(file.path);
            return (
              <button
                aria-expanded={!item.collapsed}
                aria-label={t(item.collapsed ? "expandFile" : "collapseFile", {
                  path: file.path,
                })}
                className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-base-200 disabled:cursor-default"
                disabled={file.binary}
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
                {patchQuery?.isLoading && (
                  <span className="shrink-0 text-base-content/60" role="status">
                    {t("loadingDiff")}
                  </span>
                )}
                {patchQuery?.isError && (
                  <span className="shrink-0 text-error" role="alert">
                    {t("unableToLoadGitDiff")}
                  </span>
                )}
                {file.binary ? (
                  <span className="shrink-0 text-base-content/50">
                    {t("binary")}
                  </span>
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

function parseFilePatch(patch: string) {
  return parsePatchFiles(patch).flatMap((entry) => entry.files)[0] ?? null;
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
