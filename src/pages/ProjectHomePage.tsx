import { useState, type FormEvent } from "react";
import {
  Cog6ToothIcon,
  FolderIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { open } from "@tauri-apps/plugin-dialog";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useDeleteProject,
  useProject,
  useProjectThreads,
  useUpdateProject,
} from "../app-server/hooks";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { ProjectIcon } from "../components/projects/ProjectIcon";
import { ProjectMetadataFields } from "../components/projects/ProjectMetadataFields";
import {
  DEFAULT_PROJECT_METADATA,
  parseProjectMetadata,
  projectColorClassName,
  projectMetadataToRecord,
  type ProjectMetadata,
} from "../components/projects/project-metadata";
import { ThreadCard } from "../components/common/ThreadCard";

export function ProjectHomePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const threads = useProjectThreads(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoot, setEditRoot] = useState("");
  const [editMetadata, setEditMetadata] = useState<ProjectMetadata>(
    DEFAULT_PROJECT_METADATA,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rootSelectionError, setRootSelectionError] = useState<string | null>(
    null,
  );

  if (project.isLoading) {
    return <LoadingState />;
  }
  if (project.isError || !project.data) {
    return <ErrorState>Unable to load this project.</ErrorState>;
  }

  const details = project.data.project;
  const projectMetadata = parseProjectMetadata(details.metadata);

  function handleOpenEditDialog() {
    setEditName(details.name);
    setEditRoot(details.roots[0]?.path ?? "");
    setEditMetadata(projectMetadata);
    setEditError(null);
    setRootSelectionError(null);
    setIsEditDialogOpen(true);
  }

  function handleCloseEditDialog() {
    setIsEditDialogOpen(false);
    setEditError(null);
    setRootSelectionError(null);
  }

  async function handleSelectRoot() {
    setRootSelectionError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select workspace folder",
      });
      if (typeof selected === "string") {
        setEditRoot(selected);
      }
    } catch (error) {
      setRootSelectionError(
        `Unable to select folder: ${formatErrorMessage(error)}`,
      );
    }
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = editName.trim();
    if (!name) return;

    setEditError(null);
    updateProject.mutate(
      {
        projectId,
        name,
        roots: editRoot.trim()
          ? [{ path: editRoot.trim() }, ...details.roots.slice(1)]
          : details.roots.slice(1),
        metadata: projectMetadataToRecord(editMetadata, details.metadata),
      },
      {
        onError: (error) => setEditError(formatErrorMessage(error)),
        onSuccess: () => handleCloseEditDialog(),
      },
    );
  }

  function handleOpenDeleteDialog() {
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  }

  function handleCloseDeleteDialog() {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }

  function handleDeleteProject() {
    setDeleteError(null);
    deleteProject.mutate(
      { projectId },
      {
        onError: (error) => setDeleteError(formatErrorMessage(error)),
        onSuccess: () => navigate("/projects"),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl ${projectColorClassName(projectMetadata.color)}`}
          >
            <ProjectIcon
              aria-hidden="true"
              className="size-6"
              icon={projectMetadata.icon}
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Project
            </p>
            <h1 className="text-3xl font-semibold">{details.name}</h1>
            <p className="mt-2 text-sm text-base-content/70">
              {details.roots.length} workspace root
              {details.roots.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 truncate text-xs text-base-content/60">
              {details.roots[0]?.path ?? "No workspace root configured"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            className="btn btn-primary"
            to={`/?projectId=${encodeURIComponent(projectId)}`}
          >
            New chat
          </Link>
          <button
            aria-label="Edit project"
            className="btn btn-outline btn-square"
            title="Edit project"
            type="button"
            onClick={handleOpenEditDialog}
          >
            <Cog6ToothIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label="Delete project"
            className="btn btn-outline btn-error btn-square"
            title="Delete project"
            type="button"
            onClick={handleOpenDeleteDialog}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      {isEditDialogOpen && (
        <dialog
          aria-labelledby="edit-project-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            handleCloseEditDialog();
          }}
        >
          <div className="modal-box w-full max-w-2xl px-5 py-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Cog6ToothIcon aria-hidden="true" className="size-5" />
                </div>
                <h2 className="font-semibold" id="edit-project-title">
                  Edit project
                </h2>
              </div>
              <button
                aria-label="Close edit project dialog"
                className="btn btn-ghost btn-sm btn-square"
                type="button"
                onClick={handleCloseEditDialog}
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <form className="grid w-full gap-3" onSubmit={handleEditSubmit}>
              <div className="form-control w-full">
                <input
                  aria-label="Project name"
                  className="input input-bordered min-h-11 w-full"
                  onChange={(event) => setEditName(event.target.value)}
                  required
                  value={editName}
                />
              </div>
              <div className="form-control w-full">
                <div className="flex min-w-0 w-full gap-2">
                  <button
                    aria-label={
                      editRoot
                        ? `Selected workspace folder: ${editRoot}`
                        : "Select workspace folder"
                    }
                    className="btn btn-outline min-h-11 min-w-0 flex-1 justify-start gap-2 overflow-hidden font-normal"
                    title={editRoot || "Select workspace folder"}
                    type="button"
                    onClick={() => void handleSelectRoot()}
                  >
                    <FolderIcon aria-hidden="true" className="size-4 shrink-0" />
                    <span
                      className={`min-w-0 flex-1 truncate text-left ${editRoot ? "font-mono text-xs" : "text-base-content/65"}`}
                    >
                      {editRoot || "Select workspace folder"}
                    </span>
                  </button>
                  {editRoot && (
                    <button
                      aria-label="Clear workspace folder"
                      className="btn btn-ghost btn-square min-h-11 shrink-0 text-error hover:bg-error/10"
                      title="Clear workspace folder"
                      type="button"
                      onClick={() => {
                        setEditRoot("");
                        setRootSelectionError(null);
                      }}
                    >
                      <XMarkIcon aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
                {rootSelectionError && (
                  <p className="mt-1 text-xs text-error" role="alert">
                    {rootSelectionError}
                  </p>
                )}
              </div>
              <ProjectMetadataFields
                value={editMetadata}
                onChange={setEditMetadata}
              />
              <div className="flex justify-end">
                <button
                  className="btn btn-primary min-h-11 whitespace-nowrap"
                  disabled={updateProject.isPending}
                  type="submit"
                >
                  {updateProject.isPending ? "Saving…" : "Save project"}
                </button>
              </div>
              {editError && (
                <p className="text-sm text-error" role="alert">
                  Unable to update project: {editError}
                </p>
              )}
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              aria-label="Close edit project dialog"
              type="button"
              onClick={handleCloseEditDialog}
            >
              Close
            </button>
          </form>
        </dialog>
      )}
      {isDeleteDialogOpen && (
        <dialog
          aria-labelledby="delete-project-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            handleCloseDeleteDialog();
          }}
        >
          <div className="modal-box w-full max-w-lg px-5 py-7">
            <h2 className="text-lg font-semibold" id="delete-project-title">
              Delete project?
            </h2>
            <p className="mt-3 text-sm text-base-content/70">
              This will delete <strong>{details.name}</strong> from your project
              list. Chats and workspace files will not be deleted.
            </p>
            {deleteError && (
              <p className="mt-3 text-sm text-error" role="alert">
                Unable to delete project: {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={handleCloseDeleteDialog}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={deleteProject.isPending}
                type="button"
                onClick={handleDeleteProject}
              >
                {deleteProject.isPending ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={handleCloseDeleteDialog}>
              Close
            </button>
          </form>
        </dialog>
      )}
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title">Chats</h2>
          {threads.isLoading && <LoadingState size="sm" />}
          {threads.isError && (
            <ErrorState>Unable to load project chats.</ErrorState>
          )}
          {!threads.isLoading && !threads.data?.data.length && (
            <EmptyState>No chats in this project yet.</EmptyState>
          )}
          <div className="grid gap-3">
            {threads.data?.data.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} compact />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
