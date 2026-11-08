import type { v2 } from "../../protocol";
import type { StateBadgeTone } from "../common/StateBadge";

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

export function mcpConnectionTone(
  status: v2.McpServerStatus["runtimeStatus"],
): StateBadgeTone {
  if (status === "connected") return "success";
  if (status === "starting") return "info";
  if (status === "authenticationRequired") return "warning";
  if (status === "failed") return "error";
  return "neutral";
}

export function mcpAuthTone(
  status: v2.McpServerStatus["authStatus"],
): StateBadgeTone {
  if (status === "oAuth" || status === "bearerToken") return "success";
  if (status === "notLoggedIn") return "warning";
  if (status === "unsupported") return "neutral";
  return "neutral";
}
