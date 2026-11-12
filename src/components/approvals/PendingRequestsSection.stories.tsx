import type { Story } from "@ladle/react";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import { PendingRequestsSection } from "./PendingRequestsSection";

const pending = {
  requestId: 42,
  kind: "approval",
  threadId: "thread-catalog",
  turnId: "turn-catalog",
  itemId: "item-catalog",
  request: {
    method: "item/commandExecution/requestApproval",
    id: 42,
    params: {
      command: "pnpm test",
      cwd: "/workspace",
      threadId: "thread-catalog",
      turnId: "turn-catalog",
      itemId: "item-catalog",
    },
  },
} as never as PendingServerRequest;

export const Pending: Story = () => (
  <PendingRequestsSection connected pendingRequests={[pending]} />
);
