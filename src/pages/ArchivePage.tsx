import { useTranslation } from "react-i18next";
import { ArchiveBoxIcon, ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatErrorMessage } from "@/app/error-message";
import {
  useArchivedThreadList,
  useDeleteAllArchivedThreads,
  useDeleteThread,
  useUnarchiveThread,
} from "@/app-server/hooks";
import { EmptyState, ErrorState, LoadingState } from "@/components/base/common/AsyncState";
import { ThreadCard } from "@/components/base/common/ThreadCard";
import { useNativeModalDialog } from "@/components/base/common/useNativeModalDialog";

export function ArchivePage() {
  const { t } = useTranslation("chats");

  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const deleteDialogRef = useNativeModalDialog(deleteTarget !== null);
  const deleteAllDialogRef = useNativeModalDialog(isDeleteAllDialogOpen);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{t("archivedChats")}</h1>
        </div>
        {archived.data?.data.length ? (
          <button
            aria-label={t("deleteAllArchivedChats")}
            className="btn btn-error btn-outline btn-sm gap-2"
            disabled={deleteAll.isPending}
            type="button"
            onClick={() => {
              setDeleteAllError(null);
              setIsDeleteAllDialogOpen(true);
            }}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
            {t("deleteAll")}
          </button>
        ) : null}
      </div>
      {archived.isLoading && <LoadingState />}
      {archived.isError && (
        <ErrorState
          action={
            <button
              className="btn btn-sm"
              disabled={archived.isFetching}
              onClick={() => void archived.refetch()}
              type="button"
            >
              {archived.isFetching ? t("retrying") : t("retry")}
            </button>
          }
        >
          {t("unableToLoadArchivedChats")}
        </ErrorState>
      )}
      {!archived.isLoading && !archived.data?.data.length && (
        <EmptyState
          description={t("restoredChatsWillAppearInYourActiveHistory")}
          icon={ArchiveBoxIcon}
          title={t("noArchivedChats")}
        />
      )}
      <div className="grid gap-3">
        {archived.data?.data.map((thread) => (
          <ThreadCard
            key={thread.id}
            compact
            showUpdatedAt
            thread={thread}
            actions={
              <>
                <button
                  aria-label={t("restore")}
                  className="btn btn-ghost btn-sm btn-square text-primary"
                  title={t("restore")}
                  type="button"
                  disabled={unarchive.isPending || deleteAll.isPending}
                  onClick={() => void unarchive.mutateAsync({ threadId: thread.id })}
                >
                  <ArrowUturnLeftIcon aria-hidden="true" className="size-4" />
                </button>
                <button
                  aria-label={t("delete")}
                  className="btn btn-ghost btn-sm btn-square"
                  title={t("delete")}
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
        <nav aria-label={t("archivedChatPages")} className="flex items-center justify-center gap-3">
          <button
            aria-label={t("previous")}
            className="btn btn-ghost btn-sm"
            disabled={archived.isFetching || pageNumber === 1}
            onClick={() => setCursorHistory((history) => history.slice(0, -1))}
            type="button"
          >
            {t("previous")}
          </button>
          <span aria-live="polite" className="text-sm text-base-content/60">
            {t("pageNumber", { page: pageNumber })}
          </span>
          <button
            aria-label={t("next")}
            className="btn btn-ghost btn-sm"
            disabled={archived.isFetching || !archived.data.nextCursor}
            onClick={() => setCursorHistory((history) => [...history, archived.data?.nextCursor ?? ""])}
            type="button"
          >
            {t("next")}
          </button>
        </nav>
      )}
      {deleteTarget && (
        <dialog
          aria-labelledby="delete-chat-title"
          className="modal"
          ref={deleteDialogRef}
          onCancel={(event) => {
            event.preventDefault();
            closeDeleteDialog();
          }}
        >
          <div className="modal-box">
            <h2 className="text-lg font-semibold" id="delete-chat-title">
              {t("deleteChat")}
            </h2>
            <p className="py-4 text-sm text-base-content/70">{t("deleteConfirmation", { name: deleteTarget.name })}</p>
            {deleteError && (
              <p className="alert alert-error mb-4" role="alert">
                {t("deleteError", { error: deleteError })}
              </p>
            )}
            <div className="modal-action">
              <button
                aria-label={t("cancel")}
                className="btn btn-ghost"
                disabled={deleteThread.isPending}
                onClick={closeDeleteDialog}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                aria-label={deleteThread.isPending ? t("deleting") : t("deletePermanently")}
                className="btn btn-error"
                disabled={deleteThread.isPending}
                onClick={deleteArchivedThread}
                type="button"
              >
                {deleteThread.isPending ? t("deleting") : t("deletePermanently")}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {isDeleteAllDialogOpen && (
        <dialog
          aria-labelledby="delete-all-archived-chats-title"
          className="modal"
          ref={deleteAllDialogRef}
          onCancel={(event) => {
            event.preventDefault();
            closeDeleteAllDialog();
          }}
        >
          <div className="modal-box">
            <h2 className="text-lg font-semibold" id="delete-all-archived-chats-title">
              {t("deleteAllArchivedChatsTitle")}
            </h2>
            <p className="py-4 text-sm text-base-content/70">
              {t("thisPermanentlyDeletesEveryArchivedChatThisCannotBeUndone")}
            </p>
            {deleteAllError && (
              <p className="alert alert-error mb-4" role="alert">
                {t("deleteAllError", { error: deleteAllError })}
              </p>
            )}
            <div className="modal-action">
              <button
                aria-label={t("cancel")}
                className="btn btn-ghost"
                disabled={deleteAll.isPending}
                onClick={closeDeleteAllDialog}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                aria-label={deleteAll.isPending ? t("deletingAll") : t("deleteAllPermanently")}
                className="btn btn-error"
                disabled={deleteAll.isPending}
                onClick={deleteAllArchivedThreads}
                type="button"
              >
                {deleteAll.isPending ? t("deletingAll") : t("deleteAllPermanently")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
