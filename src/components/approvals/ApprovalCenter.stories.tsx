import type { Story } from "@ladle/react";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import { ApprovalCenter } from "./ApprovalCenter";

export const Empty: Story = () => <ApprovalCenter />;

const pendingPermission = {
  requestId: 31,
  kind: "approval",
  threadId: "thread-catalog",
  turnId: "turn-catalog",
  itemId: "item-catalog",
  request: {
    method: "item/permissions/requestApproval",
    id: 31,
    params: {
      threadId: "thread-catalog",
      turnId: "turn-catalog",
      itemId: "item-catalog",
      environmentId: null,
      startedAtMs: 123,
      cwd: "/workspace",
      reason: "Need to inspect the project",
      permissions: {
        network: { enabled: true },
        fileSystem: {
          read: ["/workspace/src"],
          write: ["/workspace/tmp"],
          globScanMaxDepth: 3,
        },
      },
    },
  },
} as never as PendingServerRequest;

export const PendingRequest: Story = () => (
  <ApprovalCenter connected pendingRequests={[pendingPermission]} />
);
