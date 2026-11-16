import { i18n } from "../../app/i18n";
import type { v2 } from "../../protocol";
import type { StateBadgeTone } from "../common/StateBadge";

export function mcpConnectionStatusLabel(
  status: v2.McpServerStatus["runtimeStatus"],
): string {
  switch (status) {
    case "connected":
      return i18n.t("connected", { ns: "mcp", lng: i18n.resolvedLanguage });
    case "starting":
      return i18n.t("starting", { ns: "mcp", lng: i18n.resolvedLanguage });
    case "authenticationRequired":
      return i18n.t("authenticationRequired", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    case "failed":
      return i18n.t("connectionFailed", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    case "cancelled":
      return i18n.t("cancelled", { ns: "mcp", lng: i18n.resolvedLanguage });
    case "disabled":
      return i18n.t("disabled", { ns: "mcp", lng: i18n.resolvedLanguage });
    case "notStarted":
      return i18n.t("notStarted", { ns: "mcp", lng: i18n.resolvedLanguage });
    default:
      return i18n.t("statusUnavailable", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
  }
}

export function mcpAuthStatusLabel(
  status: v2.McpServerStatus["authStatus"],
): string {
  switch (status) {
    case "oAuth":
      return i18n.t("oauthConnected", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    case "bearerToken":
      return i18n.t("bearerTokenConfigured", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    case "notLoggedIn":
      return i18n.t("authenticationNotConfigured", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    case "unsupported":
      return i18n.t("authenticationUnsupported", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
    default:
      return i18n.t("authenticationStatusUnavailable", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      });
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
