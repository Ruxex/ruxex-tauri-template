import type { Story } from "@ladle/react";

import { PluginsSidebar } from "./PluginsSidebar";

export default { title: "Feature / Sidebar / Plugins Sidebar" };

export const Empty: Story = () => (
  <div className="h-[40rem]">
    <PluginsSidebar onClose={() => undefined} />
  </div>
);
