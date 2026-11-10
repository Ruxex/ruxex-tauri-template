import { FolderIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

export function ProjectsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-6">
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
        <div className="pt-4">
          {projects.isLoading && <LoadingState size="sm" />}
          {projects.isError && (
            <ErrorState>Unable to load projects.</ErrorState>
          )}
          {!projects.isLoading &&
            !projects.isError &&
            !projects.data?.data.length && (
              <EmptyState
                action={
                  <button
                    aria-label="Create project"
                    className="btn btn-sm btn-primary"
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
                        aria-label={`Open project ${project.name}`}
                        className="cursor-pointer hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                        key={project.id}
                        tabIndex={0}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/projects/${project.id}`);
                          }
                        }}
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
                            <span className="truncate">{project.name}</span>
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
