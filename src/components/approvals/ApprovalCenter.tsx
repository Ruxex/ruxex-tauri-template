import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import { useAppServerEvents, useServerRequests } from "../../app-server/hooks";
import { StateBadge } from "../common/StateBadge";
import { PendingRequestsSection } from "./PendingRequestsSection";

type ApprovalCenterProps = {
  connected?: boolean;
  pendingRequests?: PendingServerRequest[];
};

export function ApprovalCenter({
  connected: connectedOverride,
  pendingRequests: pendingOverride,
}: ApprovalCenterProps = {}) {
  const pendingFromStore = useServerRequests();
  const { connected: connectedFromStore } = useAppServerEvents();
  const pending = pendingOverride ?? pendingFromStore;
  const connected = connectedOverride ?? connectedFromStore;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Safety
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <ShieldCheckIcon aria-hidden="true" className="size-7 text-primary" />
          Approval center
        </h1>
      </div>
      {!connected && (
        <div className="alert alert-warning">
          <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
          <StateBadge tone="warning">Disconnected</StateBadge>
        </div>
      )}
      <PendingRequestsSection
        connected={connected}
        pendingRequests={pending}
      />
    </div>
  );
}
