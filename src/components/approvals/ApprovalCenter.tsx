import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import { useAppServerEvents, useServerRequests } from "../../app-server/hooks";
import { ServerRequestCard } from "./ServerRequestCard";

export function ApprovalCenter() {
  const pending = useServerRequests();
  const { connected } = useAppServerEvents();

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
        <p className="mt-2 text-base-content/70">
          Requests stay pending until the app-server confirms a response.
        </p>
      </div>
      {!connected && (
        <div className="alert alert-warning">
          <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
          Reconnect before responding to a request.
        </div>
      )}
      {!pending.length && (
        <div className="card border border-dashed border-base-300 bg-base-100">
          <div className="card-body items-center text-center">
            <p>No pending approvals.</p>
          </div>
        </div>
      )}
      <div className="grid gap-3">
        {pending.map((request) => (
          <ServerRequestCard
            connected={connected}
            key={String(request.requestId)}
            pending={request}
            onResolve={(result) =>
              resolveServerRequest(request.requestId, result)
            }
            onReject={(message) =>
              rejectServerRequestWithMessage(request.requestId, message)
            }
          />
        ))}
      </div>
    </div>
  );
}
