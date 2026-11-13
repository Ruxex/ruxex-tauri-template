import { ServerIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import { useMcpOauthLogin, useMcpServerStatus } from "../../app-server/hooks";
import { EmptyState } from "../../components/common/AsyncState";
import { McpStatusSummary } from "../../components/mcp/McpStatusSummary";
import { openBrowserWindow } from "../../platform/native";

export function McpCapabilitiesPanel({ active }: { active: boolean }) {
  const mcp = useMcpServerStatus({ detail: "full" }, active);
  const oauthLogin = useMcpOauthLogin();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  async function connectMcpServer(name: string) {
    setConnectionError(null);
    try {
      const response = await oauthLogin.mutateAsync({ name });
      let authorizationUrl: URL;
      try {
        authorizationUrl = new URL(response.authorizationUrl);
      } catch {
        setConnectionError("OAuth authorization URL is invalid.");
        return;
      }
      if (
        authorizationUrl.protocol !== "https:" &&
        authorizationUrl.protocol !== "http:"
      ) {
        setConnectionError("OAuth authorization URL is invalid.");
        return;
      }
      await openBrowserWindow(response.authorizationUrl);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Unable to start MCP login.",
      );
    }
  }

  return active ? (
    <section className="grid gap-4">
      {connectionError && (
        <p className="alert alert-error" role="alert">
          {connectionError}
        </p>
      )}
      {!mcp.isLoading && !mcp.isError && !mcp.data?.data.length ? (
        <EmptyState icon={ServerIcon} title="No MCP servers configured." />
      ) : (
        <article className="card w-full border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">MCP servers</h2>
            {mcp.isLoading && <span className="loading loading-spinner" />}
            {mcp.isError && (
              <p className="text-error">
                Unable to load MCP servers: {formatErrorMessage(mcp.error)}
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
                        <span>{Object.keys(server.tools).length} tools</span>
                        {(server.authStatus === "notLoggedIn" ||
                          server.authStatus === "oAuth") && (
                          <button
                            aria-label={
                              oauthLogin.isPending
                                ? "Connecting…"
                                : server.authStatus === "notLoggedIn"
                                  ? `Connect ${server.name}`
                                  : `Re-authenticate ${server.name}`
                            }
                            className="btn btn-outline btn-xs"
                            disabled={oauthLogin.isPending}
                            onClick={() => void connectMcpServer(server.name)}
                            type="button"
                          >
                            {server.authStatus === "notLoggedIn"
                              ? `Connect ${server.name}`
                              : `Re-authenticate ${server.name}`}
                          </button>
                        )}
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
