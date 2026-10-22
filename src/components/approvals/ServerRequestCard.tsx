import { useState } from "react";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ServerIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import {
  buildApprovalResponse,
  buildApprovalScope,
  buildUserInputResponse,
  canResolvePendingRequest,
  isRequestActionable,
  type ApprovalDecision,
} from "./approval-model";

type ServerRequestCardProps = {
  pending: PendingServerRequest;
  connected: boolean;
  onResolve: (result: unknown) => Promise<void>;
  onReject: (message: string) => Promise<void>;
};

export function ServerRequestCard({
  pending,
  connected,
  onResolve,
  onReject,
}: ServerRequestCardProps) {
  const [answer, setAnswer] = useState("");
  const request = pending.request;
  const actionable = canResolvePendingRequest(pending, connected);
  const isUserInput = request.method === "item/tool/requestUserInput";
  const requestParams = request.params as {
    command?: string | null;
    questions?: Array<{ id: string; header: string; question: string }>;
  };
  const scope = buildApprovalScope(request);
  const title = isUserInput
    ? "Input requested"
    : request.method.includes("requestApproval")
      ? "Approval requested"
      : "Server request";
  const RequestIcon = isUserInput
    ? QuestionMarkCircleIcon
    : request.method.includes("requestApproval")
      ? ShieldCheckIcon
      : ServerIcon;

  async function resolve(decision: ApprovalDecision) {
    const result = buildApprovalResponse(request, decision);
    if (result) {
      await onResolve(result);
    }
  }

  async function submitInput() {
    const questionId = requestParams.questions?.[0]?.id;
    const result = questionId
      ? buildUserInputResponse(request, { [questionId]: { answers: [answer] } })
      : null;
    if (result) {
      await onResolve(result);
    }
  }

  return (
    <article className="card border border-warning/50 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title text-base">
              <RequestIcon aria-hidden="true" className="size-5" />
              {title}
            </h2>
            <span className="badge badge-warning">{String(request.id)}</span>
          </div>
          {requestParams.command && (
            <code className="mt-2 block rounded bg-base-200 p-2 text-sm">
              {requestParams.command}
            </code>
          )}
          <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
            {Object.entries(scope).map(([key, value]) => (
              <div className="flex min-w-0 gap-2" key={key}>
                <dt className="font-medium">{key}</dt>
                <dd className="truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {isUserInput && requestParams.questions?.[0] && (
            <label className="form-control mt-2">
              <span className="label-text">
                {requestParams.questions[0].question}
              </span>
              <input
                className="input input-bordered input-sm mt-1"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={!actionable}
              />
            </label>
          )}
          {!isRequestActionable(request) && (
            <p className="mt-2 text-sm text-error">
              Malformed or unsupported request payload.
            </p>
          )}
          {!connected && (
            <p className="mt-2 text-sm text-warning">
              Disconnected. This request will remain pending; reconnect before
              responding.
            </p>
          )}
        </div>
        <div className="card-actions justify-end">
          {actionable && isUserInput && (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => void submitInput()}
              disabled={!answer.trim()}
            >
              <CheckIcon aria-hidden="true" className="size-4" />
              Submit
            </button>
          )}
          {actionable &&
            !isUserInput &&
            request.method.includes("requestApproval") && (
              <>
                <button
                  className="btn btn-success btn-sm"
                  type="button"
                  onClick={() => void resolve("accept")}
                >
                  <CheckIcon aria-hidden="true" className="size-4" />
                  Allow
                </button>
                <button
                  className="btn btn-error btn-sm btn-outline"
                  type="button"
                  onClick={() => void resolve("decline")}
                >
                  <XMarkIcon aria-hidden="true" className="size-4" />
                  Deny
                </button>
              </>
            )}
          {actionable &&
            !isUserInput &&
            !request.method.includes("requestApproval") && (
              <button
                className="btn btn-error btn-sm btn-outline"
                type="button"
                onClick={() => void onReject("Unsupported server request")}
              >
                <ExclamationTriangleIcon
                  aria-hidden="true"
                  className="size-4"
                />
                Reject
              </button>
            )}
        </div>
      </div>
    </article>
  );
}
