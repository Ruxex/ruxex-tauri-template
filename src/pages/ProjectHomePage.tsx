import { Link, useParams } from "react-router-dom";

import { useProject, useProjectThreads } from "../app-server/hooks";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { ThreadCard } from "../components/common/ThreadCard";

export function ProjectHomePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const threads = useProjectThreads(projectId);

  if (project.isLoading) {
    return <LoadingState />;
  }
  if (project.isError || !project.data) {
    return <ErrorState>Unable to load this project.</ErrorState>;
  }

  const details = project.data.project;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            className="btn btn-primary"
            to={`/projects/${projectId}/chat/new`}
          >
            New task
          </Link>
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost">Project menu</summary>
            <ul className="menu dropdown-content z-10 mt-2 w-44 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
              <li>
                <Link to="/settings">Settings</Link>
              </li>
            </ul>
          </details>
        </div>
      </div>
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title">Tasks</h2>
          {threads.isLoading && <LoadingState size="sm" />}
          {threads.isError && (
            <ErrorState>Unable to load project chats.</ErrorState>
          )}
          {!threads.isLoading && !threads.data?.data.length && (
            <EmptyState>No tasks in this project yet.</EmptyState>
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
