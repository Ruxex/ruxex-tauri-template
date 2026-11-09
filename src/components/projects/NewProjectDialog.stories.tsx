import type { Story } from "@ladle/react";

import { LadleDialogTrigger } from "../../../.ladle/support/LadleDialogTrigger";
import { NewProjectDialog } from "./NewProjectDialog";

export const EmptyForm: Story = () => (
  <LadleDialogTrigger
    label="Open empty project dialog"
    renderDialog={(onClose) => (
      <NewProjectDialog onClose={onClose} open />
    )}
  />
);

export const Validation: Story = () => (
  <LadleDialogTrigger
    label="Open validation dialog"
    renderDialog={(onClose) => (
      <NewProjectDialog onClose={onClose} open />
    )}
  />
);

export const SelectedWorkspace: Story = () => (
  <LadleDialogTrigger
    label="Open selected workspace dialog"
    renderDialog={(onClose) => (
      <NewProjectDialog
        initialName="Design system"
        initialRoot="/workspace/design-system"
        onClose={onClose}
        open
      />
    )}
  />
);
