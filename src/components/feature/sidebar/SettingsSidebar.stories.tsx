import type { Story } from "@ladle/react";

import { SettingsSidebar } from "./SettingsSidebar";

export const Default: Story = () => (
  <div className="h-[40rem]">
    <SettingsSidebar onClose={() => undefined} />
  </div>
);
