import { useState, type FormEvent } from "react";
import {
  ArrowLeftIcon,
  FolderIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { open } from "@tauri-apps/plugin-dialog";
import { Link, useNavigate } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useCreateProject } from "../app-server/hooks";
import { ProjectMetadataFields } from "../components/projects/ProjectMetadataFields";
import {
  DEFAULT_PROJECT_METADATA,
  projectMetadataToRecord,
  type ProjectMetadata,
} from "../components/projects/project-metadata";

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function NewProjectPage() {
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
        onSuccess: (data) => navigate(`/projects/${data.project.id}`),
      },
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-8">
      <header className="border-b border-base-300 pb-6">
        <Link className="btn btn-ghost btn-sm -ml-3 mb-5 gap-2" to="/projects">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Back to projects
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlusIcon aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Create a project
            </h1>
          </div>
        </div>
      </header>

      <form className="grid max-w-2xl gap-5" onSubmit={handleSubmit}>
        <div className="form-control w-full">
          <label className="label" htmlFor="new-project-name">
            <span className="label-text text-sm font-medium">Project name</span>
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

        <div className="flex justify-end border-t border-base-300 pt-5">
          <button
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
            Unable to create project: {formatErrorMessage(createProject.error)}
          </p>
        )}
      </form>
    </div>
  );
}
