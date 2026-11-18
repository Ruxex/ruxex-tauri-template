import type { Story } from "@ladle/react";

import { DialogShell } from "./DialogShell";

export const Open: Story = () => (
  <DialogShell open onClose={() => undefined} title="Create project">
    <p className="py-4 text-sm">A deterministic dialog preview.</p>
  </DialogShell>
);
