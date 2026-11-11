import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatErrorMessage } from "../app/error-message";
import {
  useArchivedThreadList,
  useDeleteAllArchivedThreads,
  useDeleteThread,
  useUnarchiveThread,
} from "../app-server/hooks";
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
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const currentCursor = cursorHistory.at(-1) ?? null;
  const archived = useArchivedThreadList(currentCursor);
  const deleteAll = useDeleteAllArchivedThreads();
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

  function closeDeleteAllDialog() {
    if (deleteAll.isPending) return;
    setIsDeleteAllDialogOpen(false);
    setDeleteAllError(null);
  }

  function deleteAllArchivedThreads() {
    setDeleteAllError(null);
    void deleteAll
      .mutateAsync()
      .then(() => setIsDeleteAllDialogOpen(false))
      .catch((error: unknown) => setDeleteAllError(formatErrorMessage(error)));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Archived chats</h1>
        </div>
        {archived.data?.data.length ? (
          <button
            aria-label="Delete all archived chats"
            className="btn btn-error btn-outline btn-sm gap-2"
            disabled={deleteAll.isPending}
            type="button"
            onClick={() => {
              setDeleteAllError(null);
              setIsDeleteAllDialogOpen(true);
            }}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
            Delete all
          </button>
        ) : null}
      </div>
      {archived.isLoading && <LoadingState />}
      {archived.isError && (
        <ErrorState>Unable to load archived chats.</ErrorState>
      )}
      {!archived.isLoading && !archived.data?.data.length && (
        <EmptyState
          description="Restored chats will appear in your active history."
          icon={ArchiveBoxIcon}
          title="No archived chats."
        />
      )}
      <div className="grid gap-3">
        {archived.data?.data.map((thread) => (
          <ThreadCard
            key={thread.id}
            showUpdatedAt
            thread={thread}
            actions={
              <>
                <button
                  aria-label="Restore"
                  className="btn btn-ghost btn-sm btn-square text-primary"
                  title="Restore"
                  type="button"
                  disabled={unarchive.isPending || deleteAll.isPending}
                  onClick={() =>
                    void unarchive.mutateAsync({ threadId: thread.id })
                  }
                >
                  <ArrowUturnLeftIcon aria-hidden="true" className="size-4" />
                </button>
                <button
                  aria-label="Delete"
                  className="btn btn-ghost btn-sm btn-square text-error"
                  title="Delete"
                  disabled={deleteThread.isPending}
                  onClick={() => openDeleteDialog(thread)}
                  type="button"
                >
                  <TrashIcon aria-hidden="true" className="size-4" />
                </button>
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
            aria-label="Previous"
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
            aria-label="Next"
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
                aria-label="Cancel"
                className="btn btn-ghost"
                disabled={deleteThread.isPending}
                onClick={closeDeleteDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-label={
                  deleteThread.isPending ? "Deleting…" : "Delete permanently"
                }
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
      {isDeleteAllDialogOpen && (
        <div
          aria-labelledby="delete-all-archived-chats-title"
          aria-modal="true"
          className="modal modal-open"
          role="dialog"
        >
          <div className="modal-box">
            <h2
              className="text-lg font-semibold"
              id="delete-all-archived-chats-title"
            >
              Delete all archived chats?
            </h2>
            <p className="py-4 text-sm text-base-content/70">
              This permanently deletes every archived chat. This cannot be
              undone.
            </p>
            {deleteAllError && (
              <p className="alert alert-error mb-4" role="alert">
                Unable to delete archived chats: {deleteAllError}
              </p>
            )}
            <div className="modal-action">
              <button
                aria-label="Cancel"
                className="btn btn-ghost"
                disabled={deleteAll.isPending}
                onClick={closeDeleteAllDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-label={
                  deleteAll.isPending
                    ? "Deleting all…"
                    : "Delete all permanently"
                }
                className="btn btn-error"
                disabled={deleteAll.isPending}
                onClick={deleteAllArchivedThreads}
                type="button"
              >
                {deleteAll.isPending
                  ? "Deleting all…"
                  : "Delete all permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
