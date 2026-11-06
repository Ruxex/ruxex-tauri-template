import { FolderIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { open } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatErrorMessage } from "../../app/error-message";
import { useCreateProject } from "../../app-server/hooks";
import { ProjectMetadataFields } from "./ProjectMetadataFields";
import {
  DEFAULT_PROJECT_METADATA,
  type ProjectMetadata,
  projectMetadataToRecord,
} from "./project-metadata";

type NewProjectDialogProps = {
  onClose: () => void;
};

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function NewProjectDialog({ onClose }: NewProjectDialogProps) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [root, setRoot] = useState("");
  const [metadata, setMetadata] = useState<ProjectMetadata>(
    DEFAULT_PROJECT_METADATA,
  );
  const [rootSelectionError, setRootSelectionError] = useState<string | null>(
    null,
  );

  async function handleSelectRoot() {
    setRootSelectionError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select workspace folder",
      });
      if (typeof selected === "string") {
        setRoot(selected);
      }
    } catch (error) {
      setRootSelectionError(
        `Unable to select folder: ${formatErrorMessage(error)}`,
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName) return;

    createProject.mutate(
      {
        name: projectName,
        roots: root.trim() ? [{ path: root.trim() }] : [],
        metadata: projectMetadataToRecord(metadata),
        idempotencyKey: newIdempotencyKey(),
      },
      {
        onSuccess: (data) => {
          onClose();
          navigate(`/projects/${data.project.id}`);
        },
      },
    );
  }

  return (
    <dialog
      aria-labelledby="new-project-title"
      className="modal"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {/* Keep popovers visible; modal-box defaults to overflow-y:auto. See https://github.com/saadeghi/daisyui/issues/3141 and https://github.com/saadeghi/daisyui/discussions/1812. */}
      <div className="modal-box w-full max-w-2xl overflow-visible px-5 py-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PlusIcon aria-hidden="true" className="size-5" />
            </div>
            <h2 className="font-semibold" id="new-project-title">
              Create a project
            </h2>
          </div>
          <button
            aria-label="Close create project dialog"
            className="btn btn-ghost btn-sm btn-square"
            type="button"
            onClick={onClose}
          >
            <XMarkIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form className="grid w-full gap-4" onSubmit={handleSubmit}>
          <div className="form-control w-full">
            <label className="label" htmlFor="new-project-name">
              <span className="label-text text-sm font-medium">
                Project name
              </span>
            </label>
            <input
              aria-label="Project name"
              className="input input-bordered min-h-11 w-full"
              id="new-project-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              required
              value={name}
            />
          </div>

          <div className="form-control w-full">
            <span className="label-text text-sm font-medium">
              Workspace folder
            </span>
            <div className="mt-1 flex min-w-0 w-full gap-2">
              <button
                aria-label={
                  root
                    ? `Selected workspace folder: ${root}`
                    : "Select workspace folder"
                }
                className="btn btn-outline min-h-11 min-w-0 flex-1 justify-start gap-2 overflow-hidden font-normal"
                title={root || "Select workspace folder"}
                type="button"
                onClick={() => void handleSelectRoot()}
              >
                <FolderIcon aria-hidden="true" className="size-4 shrink-0" />
                <span
                  className={`min-w-0 flex-1 truncate text-left ${root ? "font-mono text-xs" : "text-base-content/65"}`}
                >
                  {root || "Select workspace folder"}
                </span>
              </button>
              {root && (
                <button
                  aria-label="Clear workspace folder"
                  className="btn btn-ghost btn-square min-h-11 shrink-0 text-error hover:bg-error/10"
                  title="Clear workspace folder"
                  type="button"
                  onClick={() => {
                    setRoot("");
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

          <ProjectMetadataFields value={metadata} onChange={setMetadata} />

          <div className="flex justify-end border-t border-base-300 pt-4">
            <button
              aria-label="Create project"
              className="btn btn-primary min-h-11 whitespace-nowrap"
              disabled={createProject.isPending}
              type="submit"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {createProject.isPending ? "Creating…" : "Create project"}
            </button>
          </div>
          {createProject.isError && (
            <p className="text-sm text-error" role="alert">
              Unable to create project:{" "}
              {formatErrorMessage(createProject.error)}
            </p>
          )}
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          aria-label="Close create project dialog"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </form>
    </dialog>
  );
}
