import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";

import { formatErrorMessage } from "@/app/error-message";
import { useAllMcpServerStatus, useGlobalMcpConfig } from "@/app-server/hooks";
import type { McpServerDraft, McpServerEntry, McpServerJsonImportEntry } from "@/app-server/mcp-config";
import { PageContainer } from "@/components/feature/layout/PageContainer";
import { McpServerDialog } from "@/pages/mcp-servers/McpServerDialog";
import { McpServerList } from "@/pages/mcp-servers/McpServerList";
import { createMcpServerForm, type McpServerFormState } from "@/pages/mcp-servers/mcp-server-form";
import { useMcpServerConfigActions } from "@/pages/mcp-servers/useMcpServerConfigActions";

type OpenDialog = {
  entry?: McpServerEntry;
  form: McpServerFormState;
  originalName?: string;
};

export function McpServersPage() {
  const { t } = useTranslation("mcp");
  const globalConfig = useGlobalMcpConfig();
  const statuses = useAllMcpServerStatus();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actions = useMcpServerConfigActions({
    configVersion: globalConfig.data?.version,
    refetchConfig: globalConfig.refetch,
    refetchStatuses: statuses.refetch,
    statuses: statuses.data?.data ?? [],
  });

  const entries = globalConfig.data?.servers ?? [];
  const dialogEntry = dialog?.entry;
  const existingNames = useMemo(() => entries.map((entry) => entry.name), [entries]);
  function focusDialogTrigger() {
    queueMicrotask(() => {
      if (dialogTriggerRef.current?.isConnected) {
        dialogTriggerRef.current.focus();
      } else {
        addTriggerRef.current?.focus();
      }
    });
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
    if (!window.confirm(t("deleteServerConfirmation", { name: entry.name }))) {
      return false;
    }

    const deleted = await actions.deleteEntry(entry);
    if (deleted) {
      setDialog(null);
      focusDialogTrigger();
    }
    return deleted;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("mcpServers")}</h1>
        <button
          aria-label={t("addMcpServer")}
          className="btn btn-primary"
          ref={addTriggerRef}
          type="button"
          onClick={(event) => openAddDialog(event.currentTarget)}
        >
          {t("addMcpServer")}
        </button>
      </div>

      {actions.writeError && !dialog && (
        <p className="alert alert-error" role="alert">
          {actions.writeError}
        </p>
      )}

      <div className="space-y-4">
        {globalConfig.isLoading && <span className="loading loading-spinner" />}
        {globalConfig.isError && (
          <p className="text-error" role="alert">
            {t("unableToLoadGlobalMcpServers", {
              details: formatErrorMessage(globalConfig.error),
            })}
          </p>
        )}
        {statuses.isError && (
          <p className="text-error" role="alert">
            {t("unableToLoadMcpRuntimeStatus", {
              details: formatErrorMessage(statuses.error),
            })}
          </p>
        )}
        {!globalConfig.isLoading && !globalConfig.isError && !entries.length && (
          <p className="text-sm text-base-content/60">{t("noGlobalMcpServersConfigured")}</p>
        )}
        {entries.length > 0 && (
          <McpServerList
            entries={entries}
            statuses={statuses.data?.data ?? []}
            isWritePending={actions.writeConfig.isPending}
            onEdit={openEditDialog}
            onEnabledChange={(entry, enabled) => void actions.setEnabled(entry, enabled)}
          />
        )}
        {actions.higherLayerNotice && (
          <p className="text-sm text-warning" role="status">
            {actions.higherLayerNotice}
          </p>
        )}
        {actions.overrideNotice && (
          <p className="text-sm text-warning" role="status">
            {actions.overrideNotice}
          </p>
        )}
        {actions.reloadError && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-warning" role="alert">
              {actions.reloadError}
            </p>
            <button
              aria-label={actions.reloadMcp.isPending ? t("reloading") : t("retryMcpReload")}
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={actions.reloadMcp.isPending}
              onClick={() => void actions.retryReload()}
            >
              {t("retryMcpReload")}
            </button>
          </div>
        )}
      </div>

      {dialog && (
        <McpServerDialog
          key={dialog.originalName ?? "new"}
          existingNames={existingNames}
          form={dialog.form}
          isEditing={Boolean(dialog.entry)}
          isPending={actions.writeConfig.isPending}
          error={actions.writeError}
          originalName={dialog.originalName}
          onDelete={dialogEntry ? () => void handleDelete(dialogEntry) : undefined}
          onClose={closeDialog}
          onImportJson={(entries) => void handleImportJson(entries)}
          onSubmit={(draft) => void handleSave(draft)}
        />
      )}
    </PageContainer>
  );
}
