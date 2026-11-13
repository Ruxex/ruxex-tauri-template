import { ServerIcon } from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import { useAllMcpServerStatus, useGlobalMcpConfig } from "../app-server/hooks";
import type {
  McpServerDraft,
  McpServerEntry,
  McpServerJsonImportEntry,
} from "../app-server/mcp-config";
import { PageContainer } from "../components/layout/PageContainer";
import { SettingsPanel } from "../components/settings/SettingsCards";
import { McpServerList } from "./mcp-servers/McpServerList";
import { McpServerDialog } from "./mcp-servers/McpServerDialog";
import {
  createMcpServerForm,
  type McpServerFormState,
} from "./mcp-servers/mcp-server-form";
import { useMcpServerConfigActions } from "./mcp-servers/useMcpServerConfigActions";

type OpenDialog = {
  entry?: McpServerEntry;
  form: McpServerFormState;
  originalName?: string;
};

export function McpServersPage() {
  const globalConfig = useGlobalMcpConfig();
  const statuses = useAllMcpServerStatus();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actions = useMcpServerConfigActions({
    configVersion: globalConfig.data?.version,
    refetchConfig: globalConfig.refetch,
    refetchStatuses: statuses.refetch,
    statuses: statuses.data?.data ?? [],
  });

  const entries = globalConfig.data?.servers ?? [];
  const existingNames = useMemo(
    () => entries.map((entry) => entry.name),
    [entries],
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
    actions.clearWriteError();
    setDialog({ form: createMcpServerForm() });
  }

  function openEditDialog(entry: McpServerEntry, trigger: HTMLButtonElement) {
    if (!entry.draft) {
      return;
    }
    dialogTriggerRef.current = trigger;
    actions.clearWriteError();
    setDialog({
      entry,
      form: createMcpServerForm(entry.draft),
      originalName: entry.name,
    });
  }

  async function handleDelete(entry: McpServerEntry) {
    if (
      !window.confirm(
        `Delete MCP server “${entry.name}”? This removes only the global user configuration entry.`,
      )
    ) {
      return;
    }

    await actions.deleteEntry(entry);
  }

  async function handleSave(draft: McpServerDraft) {
    if (!(await actions.save(dialog?.entry, draft))) return;
    setDialog(null);
    focusDialogTrigger();
  }

  async function handleImportJson(entries: McpServerJsonImportEntry[]) {
    if (!(await actions.importJson(entries))) return;
    setDialog(null);
    focusDialogTrigger();
  }

  return (
    <PageContainer>
      <div>
        <h1 className="text-3xl font-semibold">MCP servers</h1>
      </div>

      {actions.writeError && !dialog && (
        <p className="alert alert-error" role="alert">
          {actions.writeError}
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
          <McpServerList
            entries={entries}
            statuses={statuses.data?.data ?? []}
            isWritePending={actions.writeConfig.isPending}
            onDelete={(entry) => void handleDelete(entry)}
            onEdit={openEditDialog}
            onEnabledChange={(entry, enabled) =>
              void actions.setEnabled(entry, enabled)
            }
          />
        )}
        {actions.higherLayerNotice && (
          <p className="px-5 py-4 text-sm text-warning" role="status">
            {actions.higherLayerNotice}
          </p>
        )}
        {actions.overrideNotice && (
          <p className="px-5 py-4 text-sm text-warning" role="status">
            {actions.overrideNotice}
          </p>
        )}
        {actions.reloadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-warning" role="alert">
              {actions.reloadError}
            </p>
            <button
              aria-label={
                actions.reloadMcp.isPending ? "Reloading…" : "Retry MCP reload"
              }
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={actions.reloadMcp.isPending}
              onClick={() => void actions.retryReload()}
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
          isPending={actions.writeConfig.isPending}
          error={actions.writeError}
          originalName={dialog.originalName}
          onClose={closeDialog}
          onImportJson={(entries) => void handleImportJson(entries)}
          onSubmit={(draft) => void handleSave(draft)}
        />
      )}
    </PageContainer>
  );
}
