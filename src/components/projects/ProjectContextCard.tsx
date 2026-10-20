import type { v2 } from "../../protocol";
import { projectRootSummary } from "./project-context-model";

export function ProjectContextCard({ project }: { project: v2.Project }) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Project</p>
          <h3 className="font-semibold">{project.name}</h3>
        </div>
        <div>
          <p className="text-xs font-medium text-base-content/60">Workspace roots</p>
          <p className="mt-1 whitespace-pre-wrap break-all text-sm">{projectRootSummary(project)}</p>
        </div>
        {Object.keys(project.metadata).length > 0 && (
          <div>
            <p className="text-xs font-medium text-base-content/60">Project metadata</p>
            <dl className="mt-1 space-y-1 text-sm">
              {Object.entries(project.metadata).map(([key, value]) => (
                <div className="flex gap-2" key={key}>
                  <dt className="font-medium">{key}</dt>
                  <dd className="truncate text-base-content/70">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
