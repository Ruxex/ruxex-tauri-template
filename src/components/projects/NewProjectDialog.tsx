import { FolderIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatErrorMessage } from "../../app/error-message";
import { useCreateProject } from "../../app-server/hooks";
import { DialogShell } from "../common/DialogShell";
import { DialogFooter } from "../common/DialogParts";
import { ProjectMetadataFields } from "./ProjectMetadataFields";
import {
  DEFAULT_PROJECT_METADATA,
  type ProjectMetadata,
  projectMetadataToRecord,
} from "./project-metadata";

type NewProjectDialogProps = {
  initialName?: string;
  initialRoot?: string;
  onClose: () => void;
  open?: boolean;
};

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function NewProjectDialog({
  initialName = "",
  initialRoot = "",
  onClose,
  open = true,
}: NewProjectDialogProps) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState(initialName);
  const [root, setRoot] = useState(initialRoot);
  const [metadata, setMetadata] = useState<ProjectMetadata>(
    DEFAULT_PROJECT_METADATA,
  );
  const [nameValidationError, setNameValidationError] = useState(false);
  const [rootSelectionError, setRootSelectionError] = useState<string | null>(
    null,
  );

  async function handleSelectRoot() {
    setRootSelectionError(null);
    try {
      const selected = await openDialog({
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
    if (!projectName) {
      setNameValidationError(true);
      return;
    }
    setNameValidationError(false);

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
    <DialogShell
      closeLabel="Close create project dialog"
      icon={PlusIcon}
      onClose={onClose}
      open={open}
      title="Create a project"
      titleId="new-project-title"
    >
      <form className="grid w-full gap-4" noValidate onSubmit={handleSubmit}>
        <div className="form-control w-full">
          <label className="label" htmlFor="new-project-name">
            <span className="label-text text-sm font-medium">Project name</span>
          </label>
          <input
            aria-label="Project name"
            aria-invalid={nameValidationError || undefined}
            className="input input-bordered min-h-11 w-full"
            id="new-project-name"
            onChange={(event) => {
              setName(event.target.value);
              if (event.target.value.trim()) {
                setNameValidationError(false);
              }
            }}
            placeholder="Project name"
            required
            value={name}
          />
          {nameValidationError && (
            <p className="mt-1 text-xs text-error" role="alert">
              Enter a project name.
            </p>
          )}
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
              className="btn min-h-11 min-w-0 flex-1 justify-start gap-2 overflow-hidden border-base-300 bg-base-100 font-normal hover:border-base-content/30 hover:bg-base-200"
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

        <DialogFooter>
          <button
            aria-label="Create project"
            className="btn btn-primary min-h-11 whitespace-nowrap"
            disabled={createProject.isPending}
            type="submit"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {createProject.isPending ? "Creating…" : "Create project"}
          </button>
        </DialogFooter>
        {createProject.isError && (
          <p className="text-sm text-error" role="alert">
            Unable to create project: {formatErrorMessage(createProject.error)}
          </p>
        )}
      </form>
    </DialogShell>
  );
}
