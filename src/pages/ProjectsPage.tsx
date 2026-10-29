import { useState, type FormEvent } from "react";
import {
  FolderIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { open } from "@tauri-apps/plugin-dialog";
import { Link } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useCreateProject, useProjectList } from "../app-server/hooks";
import {
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
  projectTypeLabel,
  type ProjectMetadata,
} from "../components/projects/project-metadata";

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function ProjectsPage() {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  const createProject = useCreateProject();
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
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
        onSuccess: () => {
          setName("");
          setRoot("");
          setMetadata(DEFAULT_PROJECT_METADATA);
          setIsCreatePanelOpen(false);
        },
      },
    );
  }

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        </div>
        <button
          aria-expanded={isCreatePanelOpen}
          className="btn btn-primary min-h-11 gap-2"
          type="button"
          onClick={() => setIsCreatePanelOpen((open) => !open)}
        >
          {isCreatePanelOpen ? (
            <XMarkIcon aria-hidden="true" className="size-4" />
          ) : (
            <PlusIcon aria-hidden="true" className="size-4" />
          )}
          {isCreatePanelOpen ? "Close" : "New project"}
        </button>
      </header>

      {isCreatePanelOpen && (
        <dialog
          aria-labelledby="create-project-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            setIsCreatePanelOpen(false);
          }}
        >
          <div className="modal-box w-full max-w-2xl px-5 py-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlusIcon aria-hidden="true" className="size-5" />
                </div>
                <h2 className="font-semibold" id="create-project-title">
                  Create a project
                </h2>
              </div>
              <button
                aria-label="Close create project dialog"
                className="btn btn-ghost btn-sm btn-square"
                type="button"
                onClick={() => setIsCreatePanelOpen(false)}
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <form className="grid w-full gap-3" onSubmit={handleSubmit}>
              <div className="form-control w-full">
                <input
                  aria-label="Project name"
                  className="input input-bordered min-h-11 w-full"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Project name"
                  required
                  value={name}
                />
              </div>
              <div className="form-control w-full">
                <div className="flex min-w-0 w-full gap-2">
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
              <div className="flex justify-end">
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
          <form method="dialog" className="modal-backdrop">
            <button
              aria-label="Close create project dialog"
              type="button"
              onClick={() => setIsCreatePanelOpen(false)}
            >
              Close
            </button>
          </form>
        </dialog>
      )}

      <section aria-labelledby="project-list-heading">
        <div className="flex items-end justify-between gap-4 border-b border-base-300 pb-3">
          <div>
            <h2 className="text-lg font-semibold" id="project-list-heading">
              Your projects
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {projects.data?.data.length ?? 0} workspace
              {(projects.data?.data.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="pt-4">
          {projects.isLoading && <LoadingState size="sm" />}
          {projects.isError && (
            <ErrorState>Unable to load projects.</ErrorState>
          )}
          {!projects.isLoading && !projects.isError && !projects.data?.data.length && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-100/50 px-6 py-10 text-center">
              <FolderIcon aria-hidden="true" className="mx-auto size-8 text-base-content/35" />
              <h3 className="mt-3 font-semibold">No projects yet</h3>
              <p className="mt-1 text-sm text-base-content/60">
                Create your first project to keep its chats and workspace together.
              </p>
              <button
                className="btn btn-sm btn-primary mt-4"
                type="button"
                onClick={() => setIsCreatePanelOpen(true)}
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                Create project
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table aria-label="Projects" className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Workspace</th>
                  <th>Roots</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.data?.data.map((project) => {
                  const projectMetadata = parseProjectMetadata(project.metadata);
                  return (
                  <tr className="hover" key={project.id}>
                    <td>
                      <Link
                        className="flex min-w-40 items-center gap-3 font-semibold hover:text-primary"
                        to={`/projects/${project.id}`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${projectColorClassName(projectMetadata.color)}`}
                        >
                          <ProjectIcon
                            aria-hidden="true"
                            className="size-4"
                            icon={projectMetadata.icon}
                          />
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-sm text-base-content/70">
                      {projectTypeLabel(projectMetadata.type)}
                    </td>
                    <td className="max-w-80">
                      <span className="block truncate font-mono text-xs text-base-content/65">
                        {project.roots[0]?.path ?? "No workspace root configured"}
                      </span>
                    </td>
                    <td className="text-sm text-base-content/70">
                      {project.roots.length}
                    </td>
                    <td className="text-right">
                      <Link
                        className="btn btn-ghost btn-sm"
                        to={`/projects/${project.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
