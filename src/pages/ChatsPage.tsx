import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useAllProjectList,
  useAllThreadList,
  useAllThreadSearch,
} from "../app-server/hooks";
import type { ThreadSearchOptions } from "../app-server/hooks/useThreadQueries";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { ThreadCard } from "../components/common/ThreadCard";
import { PageContainer } from "../components/layout/PageContainer";

type ChatSortKey = NonNullable<ThreadSearchOptions["sortKey"]>;
type ChatScope = "unassigned" | "projects";

const SORT_OPTIONS: { label: string; value: ChatSortKey }[] = [
  { label: "Most recently active", value: "recency_at" },
  { label: "Recently updated", value: "updated_at" },
  { label: "Newest first", value: "created_at" },
];

export function ChatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchTerm = searchParams.get("q") ?? "";
  const isGlobalSearch = searchParams.get("scope") === "all";
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearchTerm);
  const [sortKey, setSortKey] = useState<ChatSortKey>("recency_at");
  const [scope, setScope] = useState<ChatScope>("unassigned");

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearchTerm(urlSearchTerm),
      300,
    );
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
    () =>
      new Map(
        (projects.data?.data ?? []).map((project) => [
          project.id,
          project.name,
        ]),
      ),
    [projects.data],
  );
  const activeQuery = hasSearchTerm
    ? search
    : scope === "unassigned"
      ? unassignedList
      : projectList;
  const allThreads = hasSearchTerm
    ? (search.data?.data ?? []).map(({ thread }) => thread)
    : scope === "unassigned"
      ? (unassignedList.data?.data ?? [])
      : (projectList.data?.data ?? []);
  const threads =
    hasSearchTerm && isGlobalSearch
      ? allThreads
      : allThreads.filter((thread) =>
          scope === "unassigned"
            ? thread.projectId === null
            : thread.projectId !== null,
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
        <h1 className="text-3xl font-semibold tracking-tight">Chats</h1>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="input input-bordered flex min-h-11 min-w-56 flex-1 items-center gap-2">
          <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0" />
          <input
            aria-label="Search chats"
            className="min-w-0 grow bg-transparent outline-none"
            placeholder="Search chats"
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
        <label className="select select-bordered min-h-11 min-w-52">
          <span className="sr-only">Sort chats</span>
          <select
            aria-label="Sort chats"
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
        <p className="text-sm text-base-content/65">
          Showing results across all chats.
        </p>
      )}

      <div
        aria-label="Chat scope"
        className="tabs tabs-bordered"
        role="tablist"
      >
        <button
          aria-selected={scope === "unassigned"}
          className={`tab ${scope === "unassigned" ? "tab-active" : ""}`}
          onClick={() => selectScope("unassigned")}
          role="tab"
          type="button"
        >
          No project
        </button>
        <button
          aria-selected={scope === "projects"}
          className={`tab ${scope === "projects" ? "tab-active" : ""}`}
          onClick={() => selectScope("projects")}
          role="tab"
          type="button"
        >
          In projects
        </button>
      </div>

      {isLoading && <LoadingState size="sm" />}
      {isError && (
        <ErrorState>
          {formatErrorMessage(activeQuery.error) || "Unable to load chats."}
        </ErrorState>
      )}
      {!isLoading && !isError && threads.length === 0 && (
        <EmptyState
          icon={ChatBubbleLeftRightIcon}
          title={hasSearchTerm ? "No matching chats" : "No chats yet"}
        />
      )}
      {!isLoading && !isError && threads.length > 0 && (
        <ul aria-label="Chats" className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <ThreadCard
                compact
                showUpdatedAt
                projectName={
                  thread.projectId
                    ? projectNames.get(thread.projectId)
                    : undefined
                }
                thread={thread}
              />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
