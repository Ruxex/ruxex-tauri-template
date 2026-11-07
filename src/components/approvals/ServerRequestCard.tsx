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
import type { v2 } from "../../protocol";
import {
  buildApprovalResponse,
  buildApprovalScope,
  buildMcpElicitationResponse,
  buildPermissionsApprovalResponse,
  buildUserInputResponse,
  canResolvePendingRequest,
  isPermissionsApproval,
  isRequestActionable,
  type ApprovalDecision,
} from "./approval-model";
import { StateBadge } from "../common/StateBadge";

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
  const [permissionScope, setPermissionScope] =
    useState<v2.PermissionGrantScope>("turn");
  const request = pending.request;
  const actionable = canResolvePendingRequest(pending, connected);
  const isUserInput = request.method === "item/tool/requestUserInput";
  const isMcpElicitation = request.method === "mcpServer/elicitation/request";
  const isPermissionsRequest = isPermissionsApproval(request);
  const requestParams = request.params as {
    command?: string | null;
    questions?: Array<{ id: string; header: string; question: string }>;
  };
  const permissionParams = isPermissionsRequest
    ? (request.params as v2.PermissionsRequestApprovalParams)
    : null;
  const mcpParams = isMcpElicitation
    ? (request.params as {
        mode?: string;
        _meta?: unknown;
        serverName: string;
      })
    : null;
  const mcpMeta = (mcpParams?._meta ?? null) as {
    ruxex_approval_kind?: string;
    tool_title?: string;
    tool_description?: string;
    tool_params_display?: Array<{
      name: string;
      displayName: string;
      value: unknown;
    }>;
  } | null;
  const isMcpToolApproval =
    mcpParams?.mode === "form" &&
    mcpMeta?.ruxex_approval_kind === "mcp_tool_call";
  const scope = buildApprovalScope(request);
  const displayScope = Object.entries(scope).filter(
    ([key]) => !isMcpToolApproval || (key !== "threadId" && key !== "turnId"),
  );
  const title = isMcpToolApproval
    ? "MCP approval requested"
    : isUserInput
      ? "Input requested"
      : request.method.includes("requestApproval")
        ? "Approval requested"
        : "Server request";
  const RequestIcon = isMcpToolApproval
    ? ShieldCheckIcon
    : isUserInput
      ? QuestionMarkCircleIcon
      : request.method.includes("requestApproval")
        ? ShieldCheckIcon
        : ServerIcon;

  async function resolve(decision: ApprovalDecision) {
    if (isPermissionsRequest) {
      if (decision !== "accept" && decision !== "decline") {
        return;
      }
      const permissionResult = buildPermissionsApprovalResponse(
        request,
        decision,
        permissionScope,
      );
      if (permissionResult) {
        await onResolve(permissionResult);
      }
      return;
    }

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

  async function resolveMcp(action: "accept" | "cancel") {
    const result = buildMcpElicitationResponse(request, action);
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
          {isMcpToolApproval && mcpParams && (
            <div className="mt-2 space-y-2 text-sm">
              <p>{mcpParams.serverName}</p>
              {mcpMeta?.tool_title && <p>{mcpMeta.tool_title}</p>}
              {mcpMeta?.tool_description && (
                <p className="text-base-content/60">
                  {mcpMeta.tool_description}
                </p>
              )}
              {mcpMeta?.tool_params_display?.map((parameter) => (
                <div className="flex gap-2" key={parameter.name}>
                  <span className="font-medium">{parameter.displayName}</span>
                  <code>{formatValue(parameter.value)}</code>
                </div>
              ))}
            </div>
          )}
          {permissionParams && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-medium text-base-content/80">
                Requested access
              </summary>
              <div className="mt-2 space-y-2">
                {permissionParams.reason && <p>{permissionParams.reason}</p>}
                {permissionParams.permissions.network && (
                  <p>
                    <span className="font-medium">Network access:</span>
                    <span className="ml-1">
                      {permissionParams.permissions.network.enabled === true
                        ? "enabled"
                        : "requested"}
                    </span>
                  </p>
                )}
                {permissionParams.permissions.fileSystem && (
                  <div className="space-y-1">
                    <p className="font-medium">File System access</p>
                    {permissionParams.permissions.fileSystem.read?.map(
                      (path) => (
                        <p
                          className="truncate text-xs"
                          key={`read:${path}`}
                          title={path}
                        >
                          Read: {path}
                        </p>
                      ),
                    )}
                    {permissionParams.permissions.fileSystem.write?.map(
                      (path) => (
                        <p
                          className="truncate text-xs"
                          key={`write:${path}`}
                          title={path}
                        >
                          Write: {path}
                        </p>
                      ),
                    )}
                    {permissionParams.permissions.fileSystem.entries?.map(
                      (entry) => {
                        const path = formatValue(entry.path);
                        return (
                          <p
                            className="truncate text-xs"
                            key={`entry:${entry.access}:${path}`}
                          >
                            {entry.access}: {path}
                          </p>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </details>
          )}
          <details className="mt-2 text-xs text-base-content/60">
            <summary className="cursor-pointer text-sm font-medium text-base-content/70">
              Request details
            </summary>
            <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {displayScope.map(([key, value]) => (
                <div className="flex min-w-0 gap-2" key={key}>
                  <dt className="font-medium">{key}</dt>
                  <dd className="truncate" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          {isUserInput && requestParams.questions?.[0] && (
            <label className="form-control mt-2">
              <span className="label-text">
                {requestParams.questions[0].question}
              </span>
              <input
                aria-label={requestParams.questions[0].question}
                className="input input-bordered input-sm mt-1"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={!actionable}
              />
            </label>
          )}
          {actionable && permissionParams && (
            <fieldset className="mt-3 flex flex-wrap gap-3 text-sm">
              <legend className="sr-only">Permission duration</legend>
              <label className="flex items-center gap-2">
                <input
                  aria-label="This turn"
                  checked={permissionScope === "turn"}
                  name="permission-scope"
                  onChange={() => setPermissionScope("turn")}
                  type="radio"
                  value="turn"
                />
                This turn
              </label>
              <label className="flex items-center gap-2">
                <input
                  aria-label="This session"
                  checked={permissionScope === "session"}
                  name="permission-scope"
                  onChange={() => setPermissionScope("session")}
                  type="radio"
                  value="session"
                />
                This session
              </label>
            </fieldset>
          )}
          {!isRequestActionable(request) && (
            <p className="mt-2 text-sm text-error">
              Malformed or unsupported request payload.
            </p>
          )}
          {!connected && (
            <div className="mt-2">
              <StateBadge tone="warning">Disconnected</StateBadge>
            </div>
          )}
        </div>
        <div className="card-actions justify-end">
          {actionable && isUserInput && (
            <button
              aria-label="Submit"
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
                  aria-label="Allow"
                  className="btn btn-success btn-sm"
                  type="button"
                  onClick={() => void resolve("accept")}
                >
                  <CheckIcon aria-hidden="true" className="size-4" />
                  Allow
                </button>
                <button
                  aria-label="Deny"
                  className="btn btn-error btn-sm btn-outline"
                  type="button"
                  onClick={() => void resolve("decline")}
                >
                  <XMarkIcon aria-hidden="true" className="size-4" />
                  Deny
                </button>
              </>
            )}
          {actionable && isMcpToolApproval && (
            <>
              <button
                aria-label="Allow"
                className="btn btn-success btn-sm"
                type="button"
                onClick={() => void resolveMcp("accept")}
              >
                <CheckIcon aria-hidden="true" className="size-4" />
                Allow
              </button>
              <button
                aria-label="Cancel"
                className="btn btn-error btn-sm btn-outline"
                type="button"
                onClick={() => void resolveMcp("cancel")}
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
                Cancel
              </button>
            </>
          )}
          {actionable &&
            !isUserInput &&
            !isMcpToolApproval &&
            !request.method.includes("requestApproval") && (
              <button
                aria-label="Reject"
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

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
