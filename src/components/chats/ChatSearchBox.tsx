import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { formatErrorMessage } from "../../app/error-message";
import { useThreadSearch } from "../../app-server/hooks";
import { ChatListItem } from "./ChatListItem";

type ChatSearchBoxProps = {
  initialSearchTerm?: string;
  onSelect: (threadId: string) => void;
};

const SEARCH_DEBOUNCE_MS = 400;

export function ChatSearchBox({
  initialSearchTerm = "",
  onSelect,
}: ChatSearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] =
    useState(initialSearchTerm);
  const results = useThreadSearch(debouncedSearchTerm, {
    archived: false,
    limit: 8,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const rows = results.data?.data ?? [];
  const isDebouncing = searchTerm !== debouncedSearchTerm;
  const hasSearchTerm = debouncedSearchTerm.trim().length > 0;

  return (
    <div className="mb-4">
      <label className="input input-bordered input-sm flex w-full items-center gap-2">
        <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0" />
        <input
          aria-label="Search chats"
          className="min-w-0 grow bg-transparent outline-none"
          placeholder="Search chats"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </label>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {(isDebouncing || results.isLoading) && (
          <span className="loading loading-spinner loading-sm mx-3" />
        )}
        {!isDebouncing && results.isError && (
          <p className="px-3 text-xs text-error">
            {formatErrorMessage(results.error)}
          </p>
        )}
        {!isDebouncing &&
          hasSearchTerm &&
          !results.isLoading &&
          !results.isError &&
          !rows.length && (
            <p className="px-3 text-xs text-base-content/60">
              No matching chats.
            </p>
          )}
        {!isDebouncing && rows.length > 0 && (
          <ul className="menu w-full gap-1 p-0">
            {rows.slice(0, 8).map(({ thread }) => (
              <li key={thread.id}>
                <ChatListItem
                  showPreview
                  thread={thread}
                  onClick={() => onSelect(thread.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {!isDebouncing &&
        hasSearchTerm &&
        rows.length > 0 &&
        results.data?.nextCursor && (
          <Link
            className="btn btn-ghost btn-sm mt-2 w-full justify-start"
            to={`/chats?q=${encodeURIComponent(debouncedSearchTerm.trim())}&scope=all`}
          >
            View all results
          </Link>
        )}
    </div>
  );
}
