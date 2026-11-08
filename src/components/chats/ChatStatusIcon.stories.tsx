import type { Story } from "@ladle/react";

import { ChatStatusIcon } from "./ChatStatusIcon";

export const AllStatuses: Story = () => (
  <div className="flex items-center gap-4">
    <ChatStatusIcon status="running" />
    <ChatStatusIcon status="waiting" />
    <ChatStatusIcon status="completed" />
    <ChatStatusIcon status="failed" />
    <ChatStatusIcon status="stopped" />
  </div>
);
