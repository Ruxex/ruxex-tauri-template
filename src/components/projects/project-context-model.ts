import type { v2 } from "../../protocol";

export function projectRootSummary(project: v2.Project): string {
  if (project.roots.length === 0) {
    return "No workspace roots configured.";
  }
  return project.roots.map((root) => root.path).join("\n");
}
