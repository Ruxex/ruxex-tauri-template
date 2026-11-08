import type { Story } from "@ladle/react";

import { ProjectSelector } from "./ProjectSelector";

const projects = [
  { id: "project-catalog", name: "Ruxex" },
  { id: "project-design", name: "Design system" },
];

export const Populated: Story = () => (
  <ProjectSelector
    isError={false}
    isLoading={false}
    onChange={() => undefined}
    projects={projects}
    value="project-catalog"
  />
);

export const Loading: Story = () => (
  <ProjectSelector
    isError={false}
    isLoading
    onChange={() => undefined}
    projects={[]}
    value=""
  />
);

export const ProjectError: Story = () => (
  <ProjectSelector
    isError
    isLoading={false}
    onChange={() => undefined}
    projects={[]}
    value=""
  />
);
