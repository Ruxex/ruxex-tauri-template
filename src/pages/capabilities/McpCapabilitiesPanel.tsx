import { useTranslation } from "react-i18next";
import { ServerIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../../app/error-message";
import { useMcpServerStatus } from "../../app-server/hooks";
import { EmptyState } from "../../components/common/AsyncState";
import { McpOAuthLoginAction } from "../../components/mcp/McpOAuthLoginAction";
import { McpStatusSummary } from "../../components/mcp/McpStatusSummary";

export function McpCapabilitiesPanel({ active }: { active: boolean }) {
  const { t } = useTranslation("mcp");
  const mcp = useMcpServerStatus({ detail: "full" }, active);

  return active ? (
    <section className="grid gap-4">
      {!mcp.isLoading && !mcp.isError && !mcp.data?.data.length ? (
        <EmptyState icon={ServerIcon} title={t("noMcpServersConfigured")} />
      ) : (
        <article className="card w-full border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">{t("mcpServers")}</h2>
            {mcp.isLoading && <span className="loading loading-spinner" />}
            {mcp.isError && (
              <p className="text-error">
                {t("unableToLoadMcpServers", {
                  details: formatErrorMessage(mcp.error),
                })}
              </p>
            )}
            <ul className="space-y-2">
              {mcp.data?.data.map((server) => (
                <li key={server.name}>
                  <details
                    className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm"
                    data-testid={`mcp-server-details-${server.name}`}
                  >
                    <summary className="collapse-title flex flex-wrap items-center justify-between gap-3 pr-12 font-medium">
                      <span>{server.name}</span>
                      <McpStatusSummary
                        authStatus={server.authStatus}
                        runtimeStatus={server.runtimeStatus}
                      />
                    </summary>
                    <div className="collapse-content space-y-2 px-4 pb-4 pt-0 text-xs text-base-content/60">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          {t("toolCount", {
                            count: Object.keys(server.tools).length,
                          })}
                        </span>
                        <McpOAuthLoginAction
                          authStatus={server.authStatus}
                          name={server.name}
                          runtimeStatus={server.runtimeStatus}
                        />
                      </div>
                      {server.toolsError && (
                        <p className="text-error">{server.toolsError}</p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </article>
      )}
    </section>
  ) : null;
}
