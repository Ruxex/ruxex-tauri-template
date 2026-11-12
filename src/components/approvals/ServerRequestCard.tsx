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
  const permissionSummary = permissionParams
    ? buildPermissionSummary(permissionParams)
    : [];
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
      const permissionDecision = decision === "decline" ? "decline" : "accept";
      const permissionResult = buildPermissionsApprovalResponse(
        request,
        permissionDecision,
        decision === "acceptForSession" ? "session" : "turn",
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
          <h2 className="card-title text-base">
            <RequestIcon aria-hidden="true" className="size-5" />
            {title}
          </h2>
          {requestParams.command && (
            <code className="mt-2 block max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-base-200 p-2 text-sm">
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
            <section
              aria-label="Requested access"
              className="mt-2 rounded-box border border-warning/30 bg-warning/5 p-3 text-sm"
            >
              <h3 className="font-medium">Requested access</h3>
              {permissionParams.reason && (
                <p className="mt-1 text-base-content/75">
                  {permissionParams.reason}
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {permissionSummary.map((item) => (
                  <li className="truncate" key={item} title={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {isUserInput && requestParams.questions?.[0] && (
            <label className="form-control mt-2 w-full">
              <span className="label-text">
                {requestParams.questions[0].question}
              </span>
              <input
                aria-label={requestParams.questions[0].question}
                className="input input-bordered input-sm mt-1 w-full"
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
                  aria-label="Approve once"
                  className="btn btn-success btn-sm"
                  type="button"
                  onClick={() => void resolve("accept")}
                >
                  <CheckIcon aria-hidden="true" className="size-4" />
                  Approve once
                </button>
                <button
                  aria-label="Approve in this chat"
                  className="btn btn-success btn-sm btn-outline"
                  type="button"
                  onClick={() => void resolve("acceptForSession")}
                >
                  <CheckIcon aria-hidden="true" className="size-4" />
                  Approve in this chat
                </button>
                <button
                  aria-label="Reject"
                  className="btn btn-error btn-sm btn-outline"
                  type="button"
                  onClick={() => void resolve("decline")}
                >
                  <XMarkIcon aria-hidden="true" className="size-4" />
                  Reject
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

function buildPermissionSummary(
  params: v2.PermissionsRequestApprovalParams,
): string[] {
  const items: string[] = [];
  const fileSystemItems = new Set<string>();

  function addFileSystemItem(access: string, path: string): void {
    const key = `${access.toLowerCase()}:${path}`;
    if (fileSystemItems.has(key)) return;
    fileSystemItems.add(key);
    items.push(
      `${access.charAt(0).toUpperCase()}${access.slice(1)}: ${path}`,
    );
  }

  if (params.permissions.network) {
    items.push(
      params.permissions.network.enabled === true
        ? "Network access"
        : "Network access requested",
    );
  }

  const fileSystem = params.permissions.fileSystem;
  fileSystem?.read?.forEach((path) => {
    addFileSystemItem("read", path);
  });
  fileSystem?.write?.forEach((path) => {
    addFileSystemItem("write", path);
  });
  fileSystem?.entries?.forEach((entry) => {
    addFileSystemItem(entry.access, formatValue(entry.path));
  });

  return items.length > 0 ? items : ["Specific access requested"];
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "type" in value) {
    const typedValue = value as { type?: unknown; path?: unknown };
    if (typedValue.type === "path" && typeof typedValue.path === "string") {
      return typedValue.path;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
