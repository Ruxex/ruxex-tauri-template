import type { Story } from "@ladle/react";

import { noopAsync } from "../../../.ladle/support/catalog-data";
import { ChatActivityTimeline } from "./ChatActivityTimeline";

export const Empty: Story = () => (
  <ChatActivityTimeline
    connected
    items={[]}
    onReject={noopAsync}
    onResolve={noopAsync}
    pendingRequests={[]}
  />
);

export const Working: Story = () => (
  <ChatActivityTimeline
    connected
    items={[]}
    liveStatus="running"
    onReject={noopAsync}
    onResolve={noopAsync}
    pendingRequests={[]}
    workingStartedAt={Math.floor(Date.now() / 1_000) - 12}
    workingTurnId="turn-catalog"
  />
);
