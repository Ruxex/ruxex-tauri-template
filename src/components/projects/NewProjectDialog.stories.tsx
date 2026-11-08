import type { Story } from "@ladle/react";

import { NewProjectDialog } from "./NewProjectDialog";

export const EmptyForm: Story = () => (
  <NewProjectDialog onClose={() => undefined} />
);
