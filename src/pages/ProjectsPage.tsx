import { FolderIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

import { useProjectList } from "../app-server/hooks";
import { ErrorState, LoadingState } from "../components/common/AsyncState";
import { ProjectIcon } from "../components/projects/ProjectIcon";
import {
  parseProjectMetadata,
  projectColorClassName,
} from "../components/projects/project-metadata";

export function ProjectsPage() {
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        </div>
        <Link className="btn btn-primary min-h-11 gap-2" to="/projects/new">
          <PlusIcon aria-hidden="true" className="size-4" />
          New project
        </Link>
      </header>

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
          {!projects.isLoading &&
            !projects.isError &&
            !projects.data?.data.length && (
              <div className="rounded-xl border border-dashed border-base-300 bg-base-100/50 px-6 py-10 text-center">
                <FolderIcon
                  aria-hidden="true"
                  className="mx-auto size-8 text-base-content/35"
                />
                <h3 className="mt-3 font-semibold">No projects yet</h3>
                <p className="mt-1 text-sm text-base-content/60">
                  Create your first project to keep its chats and workspace
                  together.
                </p>
                <Link
                  className="btn btn-sm btn-primary mt-4"
                  to="/projects/new"
                >
                  <PlusIcon aria-hidden="true" className="size-4" />
                  Create project
                </Link>
              </div>
            )}
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table aria-label="Projects" className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Workspace</th>
                  <th>Roots</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.data?.data.map((project) => {
                  const projectMetadata = parseProjectMetadata(
                    project.metadata,
                  );
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
                      <td className="max-w-80">
                        <span className="block truncate font-mono text-xs text-base-content/65">
                          {project.roots[0]?.path ??
                            "No workspace root configured"}
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
