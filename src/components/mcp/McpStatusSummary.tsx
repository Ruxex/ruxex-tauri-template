import type { v2 } from "../../protocol";
import { StateBadge, type StateBadgeTone } from "../common/StateBadge";

export function mcpConnectionStatusLabel(
  status: v2.McpServerStatus["runtimeStatus"],
): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "starting":
      return "Starting";
    case "authenticationRequired":
      return "Authentication required";
    case "failed":
      return "Connection failed";
    case "cancelled":
      return "Cancelled";
    case "disabled":
      return "Disabled";
    case "notStarted":
      return "Not started";
    default:
      return "Status unavailable";
  }
}

export function mcpAuthStatusLabel(
  status: v2.McpServerStatus["authStatus"],
): string {
  switch (status) {
    case "oAuth":
      return "OAuth connected";
    case "bearerToken":
      return "Bearer token configured";
    case "notLoggedIn":
      return "Authentication not configured";
    case "unsupported":
      return "Authentication unsupported";
    default:
      return "Authentication status unavailable";
  }
}

function connectionTone(
  status: v2.McpServerStatus["runtimeStatus"],
): StateBadgeTone {
  if (status === "connected") return "success";
  if (status === "starting") return "info";
  if (status === "authenticationRequired") return "warning";
  if (status === "failed") return "error";
  return "neutral";
}

function authTone(status: v2.McpServerStatus["authStatus"]): StateBadgeTone {
  if (status === "oAuth" || status === "bearerToken") return "success";
  if (status === "notLoggedIn") return "warning";
  if (status === "unsupported") return "neutral";
  return "neutral";
}

export function McpStatusSummary({
  runtimeStatus,
  authStatus,
}: {
  runtimeStatus: v2.McpServerStatus["runtimeStatus"];
  authStatus: v2.McpServerStatus["authStatus"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <StateBadge tone={connectionTone(runtimeStatus)}>
        <span className="text-base-content/60">Connection:</span>
        <span>{mcpConnectionStatusLabel(runtimeStatus)}</span>
      </StateBadge>
      <StateBadge tone={authTone(authStatus)}>
        <span className="text-base-content/60">Authentication:</span>
        <span>{mcpAuthStatusLabel(authStatus)}</span>
      </StateBadge>
    </div>
  );
}
