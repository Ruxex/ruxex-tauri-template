import type { Story } from "@ladle/react";

import { NewProjectDialog } from "./NewProjectDialog";

export const EmptyForm: Story = () => (
  <NewProjectDialog onClose={() => undefined} />
);

export const Validation: Story = () => (
  <NewProjectDialog onClose={() => undefined} />
);

export const SelectedWorkspace: Story = () => (
  <NewProjectDialog
    initialName="Design system"
    initialRoot="/workspace/design-system"
    onClose={() => undefined}
  />
);
