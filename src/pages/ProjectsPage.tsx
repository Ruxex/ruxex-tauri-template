import { FolderIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useProjectList } from "../app-server/hooks";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { PageContainer } from "../components/layout/PageContainer";
import { NewProjectDialog } from "../components/projects/NewProjectDialog";
import { ProjectIcon } from "../components/projects/ProjectIcon";
import {
  parseProjectMetadata,
  projectColorClassName,
} from "../components/projects/project-metadata";
import type { v2 } from "../protocol";

type ProjectSortKey = NonNullable<v2.ProjectListParams["sortKey"]>;

const PROJECT_SORT_OPTIONS: { label: string; value: ProjectSortKey }[] = [
  { label: "Manual order", value: "position" },
  { label: "Recently active", value: "recencyAt" },
];

export function ProjectsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("position");
  const projects = useProjectList(
    {
      limit: 50,
      sortKey,
      sortDirection: sortKey === "position" ? "asc" : "desc",
    },
    true,
  );
  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        </div>
        <button
          aria-label="New project"
          className="btn btn-primary min-h-11 gap-2"
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          New project
        </button>
      </header>

      <section>
        <div>
          {projects.isLoading && <LoadingState size="sm" />}
          {projects.isError && (
            <ErrorState
              action={
                <button
                  className="btn btn-sm"
                  disabled={projects.isFetching}
                  onClick={() => void projects.refetch()}
                  type="button"
                >
                  {projects.isFetching ? "Retrying…" : "Retry"}
                </button>
              }
            >
              Unable to load projects.
            </ErrorState>
          )}
          {!projects.isLoading &&
            !projects.isError &&
            !projects.data?.data.length && (
              <EmptyState
                action={
                  <button
                    aria-label="Create project"
                    className="btn btn-sm btn-primary gap-1"
                    type="button"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <PlusIcon aria-hidden="true" className="size-4" />
                    Create project
                  </button>
                }
                description="Create a project to organize chats and workspaces."
                icon={FolderIcon}
                title="No projects yet"
              />
            )}
          {projects.data?.data.length ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <label className="select select-bordered select-sm min-w-44">
                  <span className="sr-only">Sort projects</span>
                  <select
                    aria-label="Sort projects"
                    value={sortKey}
                    onChange={(event) =>
                      setSortKey(event.target.value as ProjectSortKey)
                    }
                  >
                    {PROJECT_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
                <table aria-label="Projects" className="table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Workspace</th>
                      <th>Roots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.data?.data.map((project) => {
                      const projectMetadata = parseProjectMetadata(
                        project.metadata,
                      );
                      return (
                        <tr
                          className="transition-colors hover:bg-base-200/60"
                          key={project.id}
                        >
                          <td>
                            <div className="flex min-w-40 items-center gap-3 font-semibold">
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${projectColorClassName(projectMetadata.color)}`}
                              >
                                <ProjectIcon
                                  aria-hidden="true"
                                  className="size-4"
                                  icon={projectMetadata.icon}
                                />
                              </span>
                              <Link
                                className="truncate rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                to={`/projects/${project.id}`}
                              >
                                {project.name}
                              </Link>
                            </div>
                          </td>
                          <td className="max-w-80">
                            <span className="block truncate font-mono text-xs text-base-content/65">
                              {project.roots[0]?.path ??
                                "No workspace root configured"}
                            </span>
                          </td>
                          <td className="text-sm text-base-content/70">
                            {project.roots.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {isCreateDialogOpen && (
        <NewProjectDialog
          onClose={() => setIsCreateDialogOpen(false)}
          open={isCreateDialogOpen}
        />
      )}
    </PageContainer>
  );
}
