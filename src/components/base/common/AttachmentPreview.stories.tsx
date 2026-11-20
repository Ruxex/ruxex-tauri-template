import type { Story } from "@ladle/react";

import { AttachmentPreview } from "./AttachmentPreview";

export default { title: "Base / Common / Attachment Preview" };

export const Selected: Story = () => (
  <AttachmentPreview
    disabled={false}
    file={
      new File(["catalog image"], "design-preview.png", {
        type: "image/png",
      })
    }
    onRemove={() => undefined}
  />
);

export const Disabled: Story = () => (
  <AttachmentPreview
    disabled
    file={
      new File(["catalog image"], "design-preview.png", {
        type: "image/png",
      })
    }
    onRemove={() => undefined}
  />
);
