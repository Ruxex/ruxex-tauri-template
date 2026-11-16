import { useTranslation } from "react-i18next";
import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import type { PendingServerRequest } from "../../app-server/event-reducer";
import { ServerRequestCard } from "./ServerRequestCard";

type PendingRequestsSectionProps = {
  connected: boolean;
  pendingRequests: PendingServerRequest[];
};

export function PendingRequestsSection({
  connected,
  pendingRequests,
}: PendingRequestsSectionProps) {
  const { t } = useTranslation("approvals");

  if (!pendingRequests.length) {
    return (
      <div className="card border border-dashed border-base-300 bg-base-100">
        <div className="card-body items-center text-center">
          <p>{t("noPendingApprovals")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {pendingRequests.map((request) => (
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
  );
}
