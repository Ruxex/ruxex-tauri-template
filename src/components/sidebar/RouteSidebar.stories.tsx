import type { Story } from "@ladle/react";

import { SIDEBAR_PANELS } from "./navigation";
import { RouteSidebar, SidebarContextPanel } from "./RouteSidebar";

const panel =
  SIDEBAR_PANELS.find((item) => item.id === "automation") ?? SIDEBAR_PANELS[0];

export const Route: Story = () => (
  <div className="h-[32rem]">
    <RouteSidebar onClose={() => undefined} panel={panel} />
  </div>
);

export const ContextPanel: Story = () => (
  <div className="h-[32rem]">
    <SidebarContextPanel
      activePanel="settings"
      onClose={() => undefined}
    />
  </div>
);
