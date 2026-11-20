import type { Story } from "@ladle/react";

import { ProjectSidebar } from "./ProjectSidebar";

export default { title: "Feature / Sidebar / Project Sidebar" };

export const Expanded: Story = () => (
  <div className="h-[40rem]">
    <ProjectSidebar activePanel="home" collapsed={false} onPanelChange={() => undefined} onToggle={() => undefined} />
  </div>
);

export const Collapsed: Story = () => (
  <div className="h-[40rem]">
    <ProjectSidebar activePanel="home" collapsed onPanelChange={() => undefined} onToggle={() => undefined} />
  </div>
);
