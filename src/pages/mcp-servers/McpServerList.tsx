import { useMemo, useState } from "react";

import { useMcpResource } from "../../app-server/hooks";
import type { McpServerEntry } from "../../app-server/mcp-config";
import type { v2 } from "../../protocol";
import { McpResourceViewer } from "../../components/mcp/McpResourceViewer";
import { McpStatusSummary } from "../../components/mcp/McpStatusSummary";
import { mcpConnectionStatusLabel } from "../../components/mcp/mcp-status-labels";

type SelectedResource = {
  server: string;
  uri: string;
} | null;

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
                      : `Invalid configuration: ${entry.error}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-base-content/60">
                    {status
                      ? mcpConnectionStatusLabel(status.runtimeStatus)
                      : "Status unavailable"}
                  </span>
                  {entry.draft && (
                    <label
                      className="flex items-center"
                      title={enabled ? "Disable server" : "Enable server"}
                    >
                      <span className="sr-only">
                        {enabled ? "Enabled" : "Disabled"}
                      </span>
                      <input
                        aria-label={`Enable MCP server: ${entry.name}`}
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
                      {entry.draft && (
                        <button
                          aria-label={`Edit ${entry.name}`}
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={(event) =>
                            onEdit(entry, event.currentTarget)
                          }
                        >
                          Edit {entry.name}
                        </button>
                      )}
                      <button
                        aria-label={`Delete ${entry.name}`}
                        className="btn btn-ghost btn-xs text-error"
                        type="button"
                        onClick={() => onDelete(entry)}
                      >
                        Delete {entry.name}
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
                      Connection: Status unavailable
                    </p>
                  )}
                  {status && (
                    <p className="text-xs text-base-content/60">
                      {Object.keys(status.tools).length} tools
                    </p>
                  )}
                  {status &&
                    ((status.resources ?? []).length > 0 ||
                      (status.resourceTemplates ?? []).length > 0) && (
                      <div className="space-y-2 rounded-box bg-base-200 p-3">
                        <p className="text-sm font-medium">
                          Resources ({(status.resources ?? []).length})
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
                                  aria-label={`Read ${resource.name} from ${entry.name}`}
                                  className="btn btn-ghost btn-xs"
                                  type="button"
                                  onClick={() =>
                                    setSelectedResource({
                                      server: entry.name,
                                      uri: resource.uri,
                                    })
                                  }
                                >
                                  Read
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(status.resourceTemplates ?? []).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-base-content/70">
                              Dynamic resources
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
                  {status?.toolsError && (
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
