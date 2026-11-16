import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useReloadMcpServers } from "../app-server/hooks";
import { PageContainer } from "../components/layout/PageContainer";
import { McpCapabilitiesPanel } from "./capabilities/McpCapabilitiesPanel";
import { PluginMarketplacePanel } from "./capabilities/PluginMarketplacePanel";
import { SkillsCapabilitiesPanel } from "./capabilities/SkillsCapabilitiesPanel";

type CapabilityTab = "plugins" | "skills" | "mcp";

export function CapabilitiesPage() {
  const { t } = useTranslation("capabilities");
  const { t: tMcp } = useTranslation("mcp");
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
              ? t("plugins")
              : activeTab === "skills"
                ? t("skills")
                : "MCP"}
          </h1>
        </div>
        {activeTab === "mcp" && (
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-primary" to="/settings/mcp-servers">
              {tMcp("addMcpServer")}
            </Link>
            <button
              aria-label={reloadMcp.isPending ? t("reloading") : t("reloadMcp")}
              className="btn btn-outline"
              type="button"
              disabled={reloadMcp.isPending}
              onClick={() => void reloadMcp.mutateAsync({})}
            >
              {reloadMcp.isPending ? t("reloading") : t("reloadMcp")}
            </button>
          </div>
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
