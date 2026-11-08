import type { Story } from "@ladle/react";

import { ThreadList } from "./ThreadList";

export const Empty: Story = () => <ThreadList />;

export const ProjectThreads: Story = () => (
  <ThreadList projectId="project-catalog" />
);
