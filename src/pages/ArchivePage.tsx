import { useState } from "react";
import { Link } from "react-router-dom";

import {
  useArchivedThreadList,
  useDeleteThread,
  useUnarchiveThread,
} from "../app-server/hooks";
import { formatErrorMessage } from "../app/error-message";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { ThreadCard } from "../components/common/ThreadCard";

export function ArchivePage() {
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentCursor = cursorHistory.at(-1) ?? null;
  const archived = useArchivedThreadList(currentCursor);
  const deleteThread = useDeleteThread();
  const unarchive = useUnarchiveThread();
  const pageNumber = cursorHistory.length + 1;

  function openDeleteDialog(thread: { id: string; name?: string | null }) {
    setDeleteError(null);
    setDeleteTarget({ id: thread.id, name: thread.name ?? thread.id });
  }

  function closeDeleteDialog() {
    if (deleteThread.isPending) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  function deleteArchivedThread() {
    if (!deleteTarget) return;
    setDeleteError(null);
    void deleteThread
      .mutateAsync({ threadId: deleteTarget.id })
      .then(() => setDeleteTarget(null))
      .catch((error: unknown) => setDeleteError(formatErrorMessage(error)));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          History
        </p>
        <h1 className="text-3xl font-semibold">Archived chats</h1>
      </div>
      {archived.isLoading && <LoadingState />}
      {archived.isError && (
        <ErrorState>Unable to load archived chats.</ErrorState>
      )}
      {!archived.isLoading && !archived.data?.data.length && (
        <EmptyState>No archived chats.</EmptyState>
      )}
      <div className="grid gap-3">
        {archived.data?.data.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            actions={
              <>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={unarchive.isPending}
                  onClick={() =>
                    void unarchive.mutateAsync({ threadId: thread.id })
                  }
                >
                  Restore
                </button>
                <button
                  className="btn btn-error btn-outline btn-sm"
                  disabled={deleteThread.isPending}
                  onClick={() => openDeleteDialog(thread)}
                  type="button"
                >
                  Delete
                </button>
                <Link
                  className="btn btn-ghost btn-sm"
                  to={`/chat/${thread.id}`}
                >
                  Open
                </Link>
              </>
            }
          />
        ))}
      </div>
      {archived.data && (pageNumber > 1 || archived.data.nextCursor) && (
        <nav
          aria-label="Archived chat pages"
          className="flex items-center justify-center gap-3"
        >
          <button
            className="btn btn-ghost btn-sm"
            disabled={archived.isFetching || pageNumber === 1}
            onClick={() => setCursorHistory((history) => history.slice(0, -1))}
            type="button"
          >
            Previous
          </button>
          <span aria-live="polite" className="text-sm text-base-content/60">
            Page {pageNumber}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={archived.isFetching || !archived.data.nextCursor}
            onClick={() =>
              setCursorHistory((history) => [
                ...history,
                archived.data?.nextCursor ?? "",
              ])
            }
            type="button"
          >
            Next
          </button>
        </nav>
      )}
      {deleteTarget && (
        <div
          aria-labelledby="delete-chat-title"
          aria-modal="true"
          className="modal modal-open"
          role="dialog"
        >
          <div className="modal-box">
            <h2 className="text-lg font-semibold" id="delete-chat-title">
              Delete chat?
            </h2>
            <p className="py-4 text-sm text-base-content/70">
              Delete “{deleteTarget.name}”? This cannot be undone.
            </p>
            {deleteError && (
              <p className="alert alert-error mb-4" role="alert">
                Unable to delete chat: {deleteError}
              </p>
            )}
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                disabled={deleteThread.isPending}
                onClick={closeDeleteDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={deleteThread.isPending}
                onClick={deleteArchivedThread}
                type="button"
              >
                {deleteThread.isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
