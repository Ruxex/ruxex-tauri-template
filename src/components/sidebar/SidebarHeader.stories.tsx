import type { Story } from "@ladle/react";

import { SidebarHeader } from "./SidebarHeader";

export const Default: Story = () => (
  <SidebarHeader label="Settings" onClose={() => undefined} />
);
