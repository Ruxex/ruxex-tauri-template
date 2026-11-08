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
}: {
  runtimeStatus: v2.McpServerStatus["runtimeStatus"];
  authStatus: v2.McpServerStatus["authStatus"];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
          Connection
        </p>
        <StateBadge tone={mcpConnectionTone(runtimeStatus)}>
          {mcpConnectionStatusLabel(runtimeStatus)}
        </StateBadge>
      </div>
      <div className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
          Authentication
        </p>
        <StateBadge tone={mcpAuthTone(authStatus)}>
          {mcpAuthStatusLabel(authStatus)}
        </StateBadge>
      </div>
    </div>
  );
}
