import type { Story } from "@ladle/react";

import { ProjectIcon } from "./ProjectIcon";

export const CommonIcons: Story = () => (
  <div className="flex flex-wrap gap-4 text-primary">
    <ProjectIcon aria-label="Folder" className="size-6" icon="folder" />
    <ProjectIcon aria-label="Code" className="size-6" icon="code" />
    <ProjectIcon aria-label="Rocket" className="size-6" icon="rocket" />
    <ProjectIcon aria-label="Star" className="size-6" icon="star" />
  </div>
);
