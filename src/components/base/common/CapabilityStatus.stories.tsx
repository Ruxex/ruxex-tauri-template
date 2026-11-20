import type { Story } from "@ladle/react";

import { CapabilityStatus } from "./CapabilityStatus";

export default { title: "Base / Common / Capability Status" };

export const AllStates: Story = () => (
  <div className="flex flex-wrap gap-4">
    <CapabilityStatus label="Available" state="enabled" />
    <CapabilityStatus label="Disabled" state="disabled" />
    <CapabilityStatus label="Unsupported" state="unsupported" />
  </div>
);
