import { ServerIcon } from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  useAllMcpServerStatus,
  useGlobalMcpConfig,
  useMcpResource,
  useReloadMcpServers,
  useWriteConfig,
} from "../app-server/hooks";
import {
  type McpServerDraft,
  type McpServerEntry,
  mcpServerKeyPath,
  serializeMcpServerDraft,
} from "../app-server/mcp-config";
import { getConfigWriteErrorCode } from "../app-server/mcp-config-errors";
import { PageContainer } from "../components/layout/PageContainer";
import { McpResourceViewer } from "../components/mcp/McpResourceViewer";
import { McpStatusSummary } from "../components/mcp/McpStatusSummary";
import { mcpConnectionStatusLabel } from "../components/mcp/mcp-status-labels";
import { SettingsPanel } from "../components/settings/SettingsCards";
import type { v2 } from "../protocol";
import { McpServerDialog } from "./mcp-servers/McpServerDialog";
import {
  createMcpServerForm,
  type McpServerFormState,
} from "./mcp-servers/mcp-server-form";

type OpenDialog = {
  entry?: McpServerEntry;
  form: McpServerFormState;
  originalName?: string;
};

type SelectedResource = {
  server: string;
  uri: string;
} | null;

export function McpServersPage() {
  const globalConfig = useGlobalMcpConfig();
  const statuses = useAllMcpServerStatus();
  const writeConfig = useWriteConfig();
  const reloadMcp = useReloadMcpServers();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [higherLayerNotice, setHigherLayerNotice] = useState<string | null>(
    null,
  );
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] =
    useState<SelectedResource>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resourceRead = useMcpResource(selectedResource);

  const entries = globalConfig.data?.servers ?? [];
  const existingNames = useMemo(
    () => entries.map((entry) => entry.name),
    [entries],
  );
  const statusByName = useMemo(
    () => new Map(statuses.data?.data.map((status) => [status.name, status])),
    [statuses.data],
  );

  function focusDialogTrigger() {
    queueMicrotask(() => dialogTriggerRef.current?.focus());
  }

  function closeDialog() {
    setDialog(null);
    focusDialogTrigger();
  }

  function openAddDialog(trigger: HTMLButtonElement) {
    dialogTriggerRef.current = trigger;
    setWriteError(null);
    setDialog({ form: createMcpServerForm() });
  }

  function openEditDialog(entry: McpServerEntry, trigger: HTMLButtonElement) {
    if (!entry.draft) {
      return;
    }
    dialogTriggerRef.current = trigger;
    setWriteError(null);
    setDialog({
      entry,
      form: createMcpServerForm(entry.draft),
      originalName: entry.name,
    });
  }

  async function reloadAfterWrite(name: string, warnIfAnotherLayer: boolean) {
    let reloadSucceeded = false;
    try {
      await reloadMcp.mutateAsync({});
      reloadSucceeded = true;
      setReloadError(null);
    } catch {
      setReloadError("Saved, but MCP reload failed");
    }

    if (warnIfAnotherLayer && reloadSucceeded) {
      let currentStatuses = statuses.data?.data;
      if (typeof statuses.refetch === "function") {
        try {
          const refreshed = await statuses.refetch();
          currentStatuses = refreshed.data?.data ?? currentStatuses;
        } catch {
          currentStatuses = undefined;
        }
      }
      if (!currentStatuses?.some((status) => status.name === name)) {
        return;
      }
      setHigherLayerNotice(
        `Another configuration source is still active for MCP server “${name}”.`,
      );
    }
  }

  async function handleSave(draft: McpServerDraft) {
    const entry = dialog?.entry;
    const edits: v2.ConfigEdit[] = [
      {
        keyPath: mcpServerKeyPath(draft.name),
        value: serializeMcpServerDraft(draft, entry?.raw),
        mergeStrategy: "replace",
      },
    ];
    if (entry && entry.name !== draft.name) {
      edits.push({
        keyPath: mcpServerKeyPath(entry.name),
        value: null,
        mergeStrategy: "replace",
      });
    }

    const params: v2.ConfigBatchWriteParams = {
      edits,
      reloadUserConfig: true,
    };
    if (globalConfig.data?.version) {
      params.expectedVersion = globalConfig.data.version;
    }

    setWriteError(null);
    setReloadError(null);
    setHigherLayerNotice(null);
    setOverrideNotice(null);
    try {
      const result = await writeConfig.mutateAsync(params);
      if (result.status === "okOverridden") {
        setOverrideNotice(
          result.overriddenMetadata?.message ??
            "A higher-priority configuration layer overrides this value.",
        );
      }
    } catch (error) {
      if (getConfigWriteErrorCode(error) === "configVersionConflict") {
        void globalConfig.refetch();
      }
      setWriteError(formatErrorMessage(error));
      return;
    }

    setDialog(null);
    focusDialogTrigger();
    await reloadAfterWrite(draft.name, false);
  }

  async function handleEnabledChange(entry: McpServerEntry, enabled: boolean) {
    if (!entry.draft) {
      return;
    }

    const params: v2.ConfigBatchWriteParams = {
      edits: [
        {
          keyPath: mcpServerKeyPath(entry.name),
          value: serializeMcpServerDraft(
            { ...entry.draft, enabled },
            entry.raw,
          ),
          mergeStrategy: "replace",
        },
      ],
      reloadUserConfig: true,
    };
    if (globalConfig.data?.version) {
      params.expectedVersion = globalConfig.data.version;
    }

    setWriteError(null);
    setReloadError(null);
    setHigherLayerNotice(null);
    setOverrideNotice(null);
    try {
      const result = await writeConfig.mutateAsync(params);
      if (result.status === "okOverridden") {
        setOverrideNotice(
          result.overriddenMetadata?.message ??
            "A higher-priority configuration layer overrides this value.",
        );
      }
    } catch (error) {
      if (getConfigWriteErrorCode(error) === "configVersionConflict") {
        void globalConfig.refetch();
      }
      setWriteError(formatErrorMessage(error));
      return;
    }

    await reloadAfterWrite(entry.name, false);
  }

  async function handleDelete(entry: McpServerEntry) {
    if (
      !window.confirm(
        `Delete MCP server “${entry.name}”? This removes only the global user configuration entry.`,
      )
    ) {
      return;
    }

    const params: v2.ConfigBatchWriteParams = {
      edits: [
        {
          keyPath: mcpServerKeyPath(entry.name),
          value: null,
          mergeStrategy: "replace",
        },
      ],
      reloadUserConfig: true,
    };
    if (globalConfig.data?.version) {
      params.expectedVersion = globalConfig.data.version;
    }

    setWriteError(null);
    setReloadError(null);
    setHigherLayerNotice(null);
    setOverrideNotice(null);
    try {
      const result = await writeConfig.mutateAsync(params);
      if (result.status === "okOverridden") {
        setOverrideNotice(
          result.overriddenMetadata?.message ??
            "A higher-priority configuration layer overrides this value.",
        );
      }
    } catch (error) {
      if (getConfigWriteErrorCode(error) === "configVersionConflict") {
        void globalConfig.refetch();
      }
      setWriteError(formatErrorMessage(error));
      return;
    }

    await reloadAfterWrite(entry.name, true);
  }

  async function retryReload() {
    try {
      await reloadMcp.mutateAsync({});
      setReloadError(null);
    } catch {
      setReloadError("Saved, but MCP reload failed");
    }
  }

  return (
    <PageContainer>
      <div>
        <h1 className="text-3xl font-semibold">MCP servers</h1>
      </div>

      {writeError && !dialog && (
        <p className="alert alert-error" role="alert">
          {writeError}
        </p>
      )}

      <SettingsPanel icon={ServerIcon} title="Global MCP configuration">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-base-content/70">
            These servers are available across your projects.
          </p>
          <button
            aria-label="Add MCP server"
            className="btn btn-primary"
            type="button"
            onClick={(event) => openAddDialog(event.currentTarget)}
          >
            Add MCP server
          </button>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Configured MCP servers">
        {globalConfig.isLoading && (
          <div className="px-5 py-4">
            <span className="loading loading-spinner" />
          </div>
        )}
        {globalConfig.isError && (
          <p className="px-5 py-4 text-error" role="alert">
            Unable to load global MCP servers:{" "}
            {formatErrorMessage(globalConfig.error)}
          </p>
        )}
        {statuses.isError && (
          <p className="px-5 py-4 text-error" role="alert">
            Unable to load MCP runtime status:{" "}
            {formatErrorMessage(statuses.error)}
          </p>
        )}
        {!globalConfig.isLoading &&
          !globalConfig.isError &&
          !entries.length && (
            <p className="px-5 py-4 text-sm text-base-content/60">
              No global MCP servers configured.
            </p>
          )}
        {entries.length > 0 && (
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
                              disabled={writeConfig.isPending}
                              onChange={(event) =>
                                void handleEnabledChange(
                                  entry,
                                  event.target.checked,
                                )
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
                                  openEditDialog(entry, event.currentTarget)
                                }
                              >
                                Edit {entry.name}
                              </button>
                            )}
                            <button
                              aria-label={`Delete ${entry.name}`}
                              className="btn btn-ghost btn-xs text-error"
                              type="button"
                              onClick={() => void handleDelete(entry)}
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
                                          {template.name} ·{" "}
                                          {template.uriTemplate}
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
                          <p className="text-xs text-error">
                            {status.toolsError}
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {higherLayerNotice && (
          <p className="px-5 py-4 text-sm text-warning" role="status">
            {higherLayerNotice}
          </p>
        )}
        {overrideNotice && (
          <p className="px-5 py-4 text-sm text-warning" role="status">
            {overrideNotice}
          </p>
        )}
        {reloadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-warning" role="alert">
              {reloadError}
            </p>
            <button
              aria-label={
                reloadMcp.isPending ? "Reloading…" : "Retry MCP reload"
              }
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={reloadMcp.isPending}
              onClick={() => void retryReload()}
            >
              Retry MCP reload
            </button>
          </div>
        )}
      </SettingsPanel>

      {dialog && (
        <McpServerDialog
          key={dialog.originalName ?? "new"}
          existingNames={existingNames}
          form={dialog.form}
          isEditing={Boolean(dialog.entry)}
          isPending={writeConfig.isPending}
          error={writeError}
          originalName={dialog.originalName}
          onClose={closeDialog}
          onSubmit={(draft) => void handleSave(draft)}
        />
      )}
    </PageContainer>
  );
}
