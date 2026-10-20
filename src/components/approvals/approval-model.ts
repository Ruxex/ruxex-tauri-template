import type { ServerRequest } from "../../protocol";
import type { PendingServerRequest } from "../../app-server/event-reducer";

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type ApprovalScope = {
  command?: string;
  cwd?: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
};

export function buildApprovalScope(request: ServerRequest): ApprovalScope {
  const params = request.params as Record<string, unknown>;
  return compactScope({
    command: readString(params.command),
    cwd: readString(params.cwd),
    threadId: readString(params.threadId),
    turnId: readString(params.turnId),
    itemId: readString(params.itemId),
  });
}

export function buildApprovalResponse(
  request: ServerRequest,
  decision: ApprovalDecision,
): { decision: ApprovalDecision } | null {
  if (
    request.method === "item/commandExecution/requestApproval" ||
    request.method === "item/fileChange/requestApproval"
  ) {
    return { decision };
  }
  return null;
}

export function buildUserInputResponse(
  request: ServerRequest,
  answers: Record<string, { answers: string[] }>,
): { answers: Record<string, { answers: string[] }> } | null {
  return request.method === "item/tool/requestUserInput" ? { answers } : null;
}

export function isRequestActionable(value: unknown): value is ServerRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const request = value as Partial<ServerRequest>;
  return (
    typeof request.method === "string" &&
    (typeof request.id === "string" || typeof request.id === "number") &&
    "params" in request
  );
}

export function canResolvePendingRequest(
  request: PendingServerRequest,
  connected: boolean,
): boolean {
  return connected && isRequestActionable(request.request);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function compactScope(scope: ApprovalScope): ApprovalScope {
  return Object.fromEntries(
    Object.entries(scope).filter(([, value]) => value !== undefined),
  ) as ApprovalScope;
}
