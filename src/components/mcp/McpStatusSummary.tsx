import { useTranslation } from "react-i18next";
import type { v2 } from "../../protocol";
import { StateBadge } from "../common/StateBadge";
import {
  mcpAuthStatusLabel,
  mcpAuthTone,
  mcpConnectionStatusLabel,
  mcpConnectionTone,
} from "./mcp-status-labels";

export function McpStatusSummary({
  runtimeStatus,
  authStatus,
  includeConnection = true,
}: {
  runtimeStatus: v2.McpServerStatus["runtimeStatus"];
  authStatus: v2.McpServerStatus["authStatus"];
  includeConnection?: boolean;
}) {
  const { t } = useTranslation("mcp");
  return (
    <div className={`grid gap-2 ${includeConnection ? "sm:grid-cols-2" : ""}`}>
      {includeConnection && (
        <div className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
            {t("connection")}
          </p>
          <StateBadge tone={mcpConnectionTone(runtimeStatus)}>
            {mcpConnectionStatusLabel(runtimeStatus)}
          </StateBadge>
        </div>
      )}
      <div className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
          {t("authentication")}
        </p>
        <StateBadge tone={mcpAuthTone(authStatus)}>
          {mcpAuthStatusLabel(authStatus)}
        </StateBadge>
      </div>
    </div>
  );
}
