import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";

import { useMcpResource } from "../../app-server/hooks";
import type { McpServerEntry } from "../../app-server/mcp-config";
import type { v2 } from "../../protocol";
import { McpResourceViewer } from "../../components/mcp/McpResourceViewer";
import { McpOAuthLoginAction } from "../../components/mcp/McpOAuthLoginAction";
import { McpStatusSummary } from "../../components/mcp/McpStatusSummary";
import { mcpConnectionStatusLabel } from "../../components/mcp/mcp-status-labels";

type SelectedResource = {
  server: string;
  uri: string;
} | null;

function shouldShowToolsError(status: v2.McpServerStatus): boolean {
  if (!status.toolsError) return false;

  const authRequiredBeforeLogin =
    status.authStatus === "notLoggedIn" &&
    /\bauth required\b/i.test(status.toolsError);
  return !authRequiredBeforeLogin;
}

export function McpServerList({
  entries,
  statuses,
  isWritePending,
  onDelete,
  onEdit,
  onEnabledChange,
}: {
  entries: McpServerEntry[];
  statuses: v2.McpServerStatus[];
  isWritePending: boolean;
  onDelete: (entry: McpServerEntry) => void;
  onEdit: (entry: McpServerEntry, trigger: HTMLButtonElement) => void;
  onEnabledChange: (entry: McpServerEntry, enabled: boolean) => void;
}) {
  const { t } = useTranslation("mcp");
  const [selectedResource, setSelectedResource] =
    useState<SelectedResource>(null);
  const resourceRead = useMcpResource(selectedResource);
  const statusByName = useMemo(
    () => new Map(statuses.map((status) => [status.name, status])),
    [statuses],
  );

  return (
    <ul className="space-y-2 px-5 py-4">
      {entries.map((entry) => {
        const status = statusByName.get(entry.name);
        const enabled = entry.draft?.enabled ?? false;
        return (
          <li key={entry.name}>
            <details
              className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm"
              data-testid={`mcp-server-details-${entry.name}`}
            >
              <summary className="collapse-title flex items-center justify-between gap-4 py-4 pr-12">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.name}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-base-content/60">
                    {entry.draft
                      ? entry.draft.transport === "stdio"
                        ? `stdio · ${entry.draft.command}`
                        : `Streamable HTTP · ${entry.draft.url}`
                      : t("invalidConfiguration", { name: entry.error })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-base-content/60">
                    {status
                      ? mcpConnectionStatusLabel(status.runtimeStatus)
                      : t("statusUnavailable")}
                  </span>
                  {entry.draft && (
                    <label
                      className="flex items-center"
                      title={enabled ? t("disableServer") : t("enableServer")}
                    >
                      <span className="sr-only">
                        {enabled ? t("enabled") : t("disabled")}
                      </span>
                      <input
                        aria-label={t("enableNamedServer", {
                          name: entry.name,
                        })}
                        aria-checked={enabled}
                        checked={enabled}
                        className="toggle toggle-primary toggle-sm"
                        disabled={isWritePending}
                        onChange={(event) =>
                          onEnabledChange(entry, event.target.checked)
                        }
                        onClick={(event) => event.stopPropagation()}
                        role="switch"
                        type="checkbox"
                      />
                    </label>
                  )}
                </div>
              </summary>
              <div className="collapse-content p-0">
                <div className="space-y-4 border-t border-base-300 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.draft?.transport === "streamableHttp" && (
                        <McpOAuthLoginAction
                          available={!enabled}
                          authStatus={status?.authStatus}
                          name={entry.name}
                          runtimeStatus={status?.runtimeStatus}
                        />
                      )}
                      {entry.draft && (
                        <button
                          aria-label={t("editNamedServer", {
                            name: entry.name,
                          })}
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={(event) =>
                            onEdit(entry, event.currentTarget)
                          }
                        >
                          {t("editNamedServer", { name: entry.name })}
                        </button>
                      )}
                      <button
                        aria-label={t("deleteNamedServer", {
                          name: entry.name,
                        })}
                        className="btn btn-ghost btn-xs text-error"
                        type="button"
                        onClick={() => onDelete(entry)}
                      >
                        {t("deleteNamedServer", { name: entry.name })}
                      </button>
                    </div>
                  </div>
                  {status ? (
                    <McpStatusSummary
                      authStatus={status.authStatus}
                      includeConnection={false}
                      runtimeStatus={status.runtimeStatus}
                    />
                  ) : (
                    <p className="text-xs text-base-content/60">
                      {t("connectionStatusUnavailable")}
                    </p>
                  )}
                  {status && (
                    <p className="text-xs text-base-content/60">
                      {t("toolCount", {
                        count: Object.keys(status.tools).length,
                      })}
                    </p>
                  )}
                  {status &&
                    ((status.resources ?? []).length > 0 ||
                      (status.resourceTemplates ?? []).length > 0) && (
                      <div className="space-y-2 rounded-box bg-base-200 p-3">
                        <p className="text-sm font-medium">
                          {t("resourceCount", {
                            count: (status.resources ?? []).length,
                          })}
                        </p>
                        {(status.resources ?? []).length > 0 && (
                          <ul className="space-y-1">
                            {(status.resources ?? []).map((resource) => (
                              <li
                                className="flex items-center justify-between gap-2"
                                key={resource.uri}
                              >
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm"
                                    title={resource.uri}
                                  >
                                    {resource.title ?? resource.name}
                                  </p>
                                  <p className="truncate text-xs text-base-content/60">
                                    {resource.mimeType ?? resource.uri}
                                  </p>
                                </div>
                                <button
                                  aria-label={t("readNamedResource", {
                                    resource: resource.name,
                                    server: entry.name,
                                  })}
                                  className="btn btn-ghost btn-xs"
                                  type="button"
                                  onClick={() =>
                                    setSelectedResource({
                                      server: entry.name,
                                      uri: resource.uri,
                                    })
                                  }
                                >
                                  {t("read")}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(status.resourceTemplates ?? []).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-base-content/70">
                              {t("dynamicResources")}
                            </p>
                            <ul className="mt-1 space-y-1 text-xs text-base-content/60">
                              {(status.resourceTemplates ?? []).map(
                                (template) => (
                                  <li key={template.uriTemplate}>
                                    {template.name} · {template.uriTemplate}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {selectedResource?.server === entry.name && (
                          <McpResourceViewer
                            error={resourceRead.error}
                            isLoading={resourceRead.isLoading}
                            response={resourceRead.data}
                          />
                        )}
                      </div>
                    )}
                  {status && shouldShowToolsError(status) && (
                    <p className="text-xs text-error">{status.toolsError}</p>
                  )}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
