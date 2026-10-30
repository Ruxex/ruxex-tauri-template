import { Link } from "react-router-dom";

import { useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  useAppServerEvents,
  activeThreadListParams,
  useThreadList,
  useThreadSearch,
} from "../app-server/hooks";
import { ThreadCard } from "../components/common/ThreadCard";
import { organizeChats } from "../components/chats/chat-organizer";

export function ThreadsPage() {
  const [search, setSearch] = useState("");
  const threads = useThreadList(activeThreadListParams());
  const searchResults = useThreadSearch(search);
  const events = useAppServerEvents();
  const rows = search.trim()
    ? (searchResults.data?.data.map((result) => result.thread) ?? [])
    : (threads.data?.data ?? []);
  const groups = organizeChats(
    rows.map((thread) => ({
      ...thread,
      liveStatus: events.threads[thread.id]?.status,
      waitingForRequest: Object.values(events.pendingServerRequests).some(
        (request) => request.threadId === thread.id,
      ),
    })),
  );
  const searchError =
    search.trim() && searchResults.isError ? searchResults.error : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            History
          </p>
          <h1 className="text-3xl font-semibold">Threads</h1>
        </div>
        <Link className="btn btn-primary" to="/">
          New chat
        </Link>
      </div>
      <input
        className="input input-bordered w-full"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search chats"
        aria-label="Search chats"
      />
      {(threads.isLoading || searchResults.isLoading) && (
        <span className="loading loading-spinner loading-lg" />
      )}
      {threads.isError && (
        <p className="alert alert-error">{formatErrorMessage(threads.error)}</p>
      )}
      {searchError && (
        <p className="alert alert-error">{formatErrorMessage(searchError)}</p>
      )}
      {!threads.isLoading &&
        !searchResults.isLoading &&
        !searchError &&
        rows.length === 0 && (
          <div className="card border border-dashed border-base-300 bg-base-100">
            <div className="card-body items-center text-center">
              <p>No threads yet.</p>
              <Link className="btn btn-sm btn-primary" to="/">
                Start a chat
              </Link>
            </div>
          </div>
        )}
      <div className="space-y-5">
        {(
          [
            ["Pinned", groups.pinned],
            ["Active", groups.active],
            ["Recent", groups.recent],
          ] as const
        ).map(([label, group]) =>
          group.length > 0 ? (
            <section
              aria-labelledby={`${label.toLowerCase()}-chats-heading`}
              key={label}
            >
              <h2
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/60"
                id={`${label.toLowerCase()}-chats-heading`}
              >
                {label} chats
              </h2>
              <div className="grid gap-3">
                {group.map((thread) => (
                  <ThreadCard key={thread.id} thread={thread} />
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </div>
  );
}
