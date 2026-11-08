import type { Story } from "@ladle/react";

import { HomeSidebar } from "./HomeSidebar";

export const Empty: Story = () => (
  <div className="h-[40rem]">
    <HomeSidebar onClose={() => undefined} />
  </div>
);
