import type { Story } from "@ladle/react";

import { SidebarHeader } from "./SidebarHeader";

export default { title: "Feature / Sidebar / Sidebar Header" };

export const Default: Story = () => <SidebarHeader label="Settings" onClose={() => undefined} />;
