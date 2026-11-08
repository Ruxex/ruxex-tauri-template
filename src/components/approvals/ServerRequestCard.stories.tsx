import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import { ServerRequestCard } from "./ServerRequestCard";

function Surface({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl bg-base-200 p-4">{children}</div>;
}

const approvalPending = {
  requestId: 17,
  kind: "approval",
  threadId: "thread-catalog",
  turnId: "turn-catalog",
  itemId: "item-catalog",
  request: {
    method: "item/commandExecution/requestApproval",
    id: 17,
    params: {
      command: "pnpm check",
      cwd: "/workspace",
      threadId: "thread-catalog",
      turnId: "turn-catalog",
      itemId: "item-catalog",
    },
  },
} as never as PendingServerRequest;

const permissionsPending = {
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
          read: ["/workspace/read"],
          write: ["/workspace/write"],
          globScanMaxDepth: 3,
        },
      },
    },
  },
} as never as PendingServerRequest;

const noopResolve = async () => undefined;

export const ConnectedApproval: Story = () => (
  <Surface>
    <ServerRequestCard
      connected
      onReject={noopResolve}
      onResolve={noopResolve}
      pending={approvalPending}
    />
  </Surface>
);

export const DisconnectedApproval: Story = () => (
  <Surface>
    <ServerRequestCard
      connected={false}
      onReject={noopResolve}
      onResolve={noopResolve}
      pending={approvalPending}
    />
  </Surface>
);

export const PermissionRequest: Story = () => (
  <Surface>
    <ServerRequestCard
      connected
      onReject={noopResolve}
      onResolve={noopResolve}
      pending={permissionsPending}
    />
  </Surface>
);
