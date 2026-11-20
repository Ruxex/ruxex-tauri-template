import type { Story } from "@ladle/react";

import { SettingsSidebar } from "./SettingsSidebar";

export default { title: "Feature / Sidebar / Settings Sidebar" };

export const Default: Story = () => (
  <div className="h-[40rem]">
    <SettingsSidebar onClose={() => undefined} />
  </div>
);
