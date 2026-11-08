import type { Story } from "@ladle/react";

import { PluginsSidebar } from "./PluginsSidebar";

export const Empty: Story = () => (
  <div className="h-[40rem]">
    <PluginsSidebar onClose={() => undefined} />
  </div>
);
