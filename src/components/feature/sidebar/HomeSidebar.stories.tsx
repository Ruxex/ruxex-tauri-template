import type { Story } from "@ladle/react";

import { HomeSidebar } from "./HomeSidebar";

export default { title: "Feature / Sidebar / Home Sidebar" };

export const Empty: Story = () => (
  <div className="h-[40rem]">
    <HomeSidebar onClose={() => undefined} />
  </div>
);
