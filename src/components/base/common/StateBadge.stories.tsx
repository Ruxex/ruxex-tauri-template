import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import { StateBadge } from "./StateBadge";

function Surface({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 bg-base-100 p-6">{children}</div>;
}

export const AllTones: Story = () => (
  <Surface>
    <StateBadge tone="success">Connected</StateBadge>
    <StateBadge tone="warning">Authentication required</StateBadge>
    <StateBadge tone="error">Connection failed</StateBadge>
    <StateBadge tone="info">Starting</StateBadge>
    <StateBadge tone="neutral">Status unavailable</StateBadge>
  </Surface>
);
