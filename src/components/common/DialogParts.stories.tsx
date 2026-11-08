import type { Story } from "@ladle/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

import { DialogFooter, DialogHeader } from "./DialogParts";

export const HeaderAndFooter: Story = () => (
  <section className="max-w-xl rounded-box bg-base-100 p-5 shadow-sm">
    <DialogHeader
      closeLabel="Close dialog"
      icon={InformationCircleIcon}
      onClose={() => undefined}
      title="Review settings"
      titleId="catalog-dialog-title"
    />
    <p className="text-sm text-base-content/70">
      Dialog content is kept intentionally small so the header and footer
      spacing remain visible.
    </p>
    <DialogFooter>
      <button className="btn btn-ghost btn-sm" type="button">
        Cancel
      </button>
      <button className="btn btn-primary btn-sm" type="button">
        Save changes
      </button>
    </DialogFooter>
  </section>
);
