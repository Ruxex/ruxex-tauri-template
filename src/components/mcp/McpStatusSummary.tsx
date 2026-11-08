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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <StateBadge tone={mcpConnectionTone(runtimeStatus)}>
        <span className="text-base-content/60">Connection:</span>
        <span>{mcpConnectionStatusLabel(runtimeStatus)}</span>
      </StateBadge>
      <StateBadge tone={mcpAuthTone(authStatus)}>
        <span className="text-base-content/60">Authentication:</span>
        <span>{mcpAuthStatusLabel(authStatus)}</span>
      </StateBadge>
    </div>
  );
}
