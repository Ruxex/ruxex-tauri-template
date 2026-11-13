import { useLocation } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useReloadMcpServers } from "../app-server/hooks";
import { PageContainer } from "../components/layout/PageContainer";
import { McpCapabilitiesPanel } from "./capabilities/McpCapabilitiesPanel";
import { PluginMarketplacePanel } from "./capabilities/PluginMarketplacePanel";
import { SkillsCapabilitiesPanel } from "./capabilities/SkillsCapabilitiesPanel";

type CapabilityTab = "plugins" | "skills" | "mcp";

export function CapabilitiesPage() {
  const location = useLocation();
  const activeTab: CapabilityTab =
    location.pathname === "/capabilities/skills"
      ? "skills"
      : location.pathname === "/capabilities/mcp"
        ? "mcp"
        : "plugins";
  const reloadMcp = useReloadMcpServers();

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {activeTab === "plugins"
              ? "Plugins"
              : activeTab === "skills"
                ? "Skills"
                : "MCP"}
          </h1>
        </div>
        {activeTab === "mcp" && (
          <button
            aria-label={reloadMcp.isPending ? "Reloading…" : "Reload MCP"}
            className="btn btn-primary"
            type="button"
            disabled={reloadMcp.isPending}
            onClick={() => void reloadMcp.mutateAsync({})}
          >
            {reloadMcp.isPending ? "Reloading…" : "Reload MCP"}
          </button>
        )}
      </div>
      {activeTab === "mcp" && reloadMcp.isError && (
        <p className="alert alert-error">
          {formatErrorMessage(reloadMcp.error)}
        </p>
      )}
      <McpCapabilitiesPanel active={activeTab === "mcp"} />
      <SkillsCapabilitiesPanel active={activeTab === "skills"} />
      <PluginMarketplacePanel active={activeTab === "plugins"} />
    </PageContainer>
  );
}
