import { useTranslation } from "react-i18next";
import { ChatBubbleLeftRightIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "@/app/error-message";
import { useAllProjectList, useAllThreadList, useAllThreadSearch } from "@/app-server/hooks";
import type { ThreadSearchOptions } from "@/app-server/hooks/useThreadQueries";
import { EmptyState, ErrorState, LoadingState } from "@/components/base/common/AsyncState";
import { handleTabListKeyDown } from "@/components/base/common/tab-keyboard";
import { ChatTable } from "@/components/composite/chats/ChatTable";
import { PageContainer } from "@/components/feature/layout/PageContainer";

type ChatSortKey = NonNullable<ThreadSearchOptions["sortKey"]>;
type ChatScope = "unassigned" | "projects";

export function ChatsPage() {
  const { t } = useTranslation("chats");

  const SORT_OPTIONS: { label: string; value: ChatSortKey }[] = [
    { label: t("mostRecentlyActive"), value: "recency_at" },
    { label: t("recentlyUpdated"), value: "updated_at" },
    { label: t("newestFirst"), value: "created_at" },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchTerm = searchParams.get("q") ?? "";
  const isGlobalSearch = searchParams.get("scope") === "all";
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearchTerm);
  const [sortKey, setSortKey] = useState<ChatSortKey>("recency_at");
  const [scope, setScope] = useState<ChatScope>("unassigned");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(urlSearchTerm), 300);
    return () => window.clearTimeout(timeout);
  }, [urlSearchTerm]);

  const trimmedSearchTerm = debouncedSearchTerm.trim();
  const isSearchPending = urlSearchTerm.trim() !== trimmedSearchTerm;
  const hasSearchTerm = Boolean(urlSearchTerm.trim());
  const unassignedList = useAllThreadList(
    {
      archived: false,
      sortKey,
      sortDirection: "desc",
      projectId: null,
    },
    !hasSearchTerm && scope === "unassigned",
  );
  const projectList = useAllThreadList(
    { archived: false, sortKey, sortDirection: "desc" },
    !hasSearchTerm && scope === "projects",
  );
  const search = useAllThreadSearch(
    trimmedSearchTerm,
    { archived: false, sortKey, sortDirection: "desc" },
    hasSearchTerm && !isSearchPending,
  );
  const projects = useAllProjectList({
    sortKey: "position",
    sortDirection: "asc",
  });

  const projectNames = useMemo(
    () => new Map((projects.data?.data ?? []).map((project) => [project.id, project.name])),
    [projects.data],
  );
  const activeQuery = hasSearchTerm ? search : scope === "unassigned" ? unassignedList : projectList;
  const allThreads = hasSearchTerm
    ? (search.data?.data ?? []).map(({ thread }) => thread)
    : scope === "unassigned"
      ? (unassignedList.data?.data ?? [])
      : (projectList.data?.data ?? []);
  const threads =
    hasSearchTerm && isGlobalSearch
      ? allThreads
      : allThreads.filter((thread) =>
          scope === "unassigned" ? thread.projectId === null : thread.projectId !== null,
        );
  const isLoading = isSearchPending || activeQuery.isLoading;
  const isError = !isSearchPending && activeQuery.isError;

  function selectScope(nextScope: ChatScope) {
    setScope(nextScope);
    if (isGlobalSearch) {
      const next = new URLSearchParams(searchParams);
      next.delete("scope");
      setSearchParams(next, { replace: true });
    }
  }

  return (
    <PageContainer>
      <header className="pb-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("chats")}</h1>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="input input-bordered flex min-w-56 flex-1 items-center gap-2">
          <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0" />
          <input
            aria-label={t("searchChats")}
            className="min-w-0 grow bg-transparent outline-none"
            placeholder={t("searchChats")}
            type="search"
            value={urlSearchTerm}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              const value = event.target.value;
              if (value.trim()) next.set("q", value);
              else {
                next.delete("q");
                next.delete("scope");
                setScope("unassigned");
              }
              setSearchParams(next, { replace: true });
            }}
          />
        </label>
        <label className="select select-bordered min-w-52">
          <span className="sr-only">{t("sortChats")}</span>
          <select
            aria-label={t("sortChats")}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as ChatSortKey)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasSearchTerm && isGlobalSearch && (
        <p className="text-sm text-base-content/65">{t("showingResultsAcrossAllChats")}</p>
      )}

      <div className="attached-tabs">
        <div aria-label={t("chatScope")} className="attached-tablist" onKeyDown={handleTabListKeyDown} role="tablist">
          <button
            aria-selected={scope === "unassigned"}
            className="attached-tab"
            id="chat-scope-unassigned-tab"
            onClick={() => selectScope("unassigned")}
            role="tab"
            tabIndex={scope === "unassigned" ? 0 : -1}
            type="button"
          >
            {t("noProject")}
          </button>
          <button
            aria-selected={scope === "projects"}
            className="attached-tab"
            id="chat-scope-projects-tab"
            onClick={() => selectScope("projects")}
            role="tab"
            tabIndex={scope === "projects" ? 0 : -1}
            type="button"
          >
            {t("inProjects")}
          </button>
        </div>

        <div
          aria-labelledby={scope === "unassigned" ? "chat-scope-unassigned-tab" : "chat-scope-projects-tab"}
          className="attached-tabpanel p-4"
          id="chat-scope-panel"
          role="tabpanel"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: A tab panel needs to be reachable when it has no focusable content.
          tabIndex={0}
        >
          {isLoading && <LoadingState size="sm" />}
          {isError && (
            <ErrorState
              action={
                <button
                  className="btn btn-sm"
                  disabled={activeQuery.isFetching}
                  onClick={() => void activeQuery.refetch()}
                  type="button"
                >
                  {activeQuery.isFetching ? t("retrying") : t("retry")}
                </button>
              }
            >
              {formatErrorMessage(activeQuery.error) || t("unableToLoadChats")}
            </ErrorState>
          )}
          {!isLoading && !isError && threads.length === 0 && (
            <EmptyState
              icon={ChatBubbleLeftRightIcon}
              title={hasSearchTerm ? t("noMatchingChats") : t("noChatsYet")}
            />
          )}
          {!isLoading && !isError && threads.length > 0 && (
            <ChatTable
              projectNames={scope === "projects" || isGlobalSearch ? projectNames : undefined}
              threads={threads}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
