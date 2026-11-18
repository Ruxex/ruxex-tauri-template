import type { Story } from "@ladle/react";

import { ChatSidebarSections } from "./ChatSidebarSections";

export const EmptyProjects: Story = () => (
  <div className="h-[32rem] w-80 bg-base-100 p-4">
    <ChatSidebarSections onClose={() => undefined} />
  </div>
);
