import type { Story } from "@ladle/react";

import { LadleDialogTrigger } from "../../../../.ladle/support/LadleDialogTrigger";
import { DialogShell } from "./DialogShell";

export default { title: "Base / Common / Dialog Shell" };

export const Open: Story = () => (
  <LadleDialogTrigger
    renderDialog={(onClose) => (
      <DialogShell open onClose={onClose} title="Create project">
        <p className="py-4 text-sm">A deterministic dialog preview.</p>
      </DialogShell>
    )}
  />
);
