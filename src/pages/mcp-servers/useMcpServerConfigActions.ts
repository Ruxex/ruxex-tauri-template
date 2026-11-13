import { useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import { useReloadMcpServers, useWriteConfig } from "../../app-server/hooks";
import {
  type McpServerDraft,
  type McpServerEntry,
  type McpServerJsonImportEntry,
  mcpServerKeyPath,
  serializeMcpServerDraft,
} from "../../app-server/mcp-config";
import { getConfigWriteErrorCode } from "../../app-server/mcp-config-errors";
import type { v2 } from "../../protocol";

type StatusResult = {
  data?: v2.ListMcpServerStatusResponse;
};

export function useMcpServerConfigActions({
  configVersion,
  refetchConfig,
  refetchStatuses,
  statuses,
}: {
  configVersion?: string;
  refetchConfig: () => Promise<unknown>;
  refetchStatuses: () => Promise<StatusResult>;
  statuses: v2.McpServerStatus[];
}) {
  const writeConfig = useWriteConfig();
  const reloadMcp = useReloadMcpServers();
  const [writeError, setWriteError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [higherLayerNotice, setHigherLayerNotice] = useState<string | null>(
    null,
  );
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);

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
      let currentStatuses: v2.McpServerStatus[] | undefined = statuses;
      try {
        const refreshed = await refetchStatuses();
        currentStatuses = refreshed.data?.data ?? currentStatuses;
      } catch {
        currentStatuses = undefined;
      }
      if (!currentStatuses?.some((status) => status.name === name)) return;
      setHigherLayerNotice(
        `Another configuration source is still active for MCP server “${name}”.`,
      );
    }
  }

  async function writeEdits(edits: v2.ConfigEdit[]): Promise<boolean> {
    const params: v2.ConfigBatchWriteParams = {
      edits,
      reloadUserConfig: true,
    };
    if (configVersion) params.expectedVersion = configVersion;

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
      return true;
    } catch (error) {
      if (getConfigWriteErrorCode(error) === "configVersionConflict") {
        void refetchConfig();
      }
      setWriteError(formatErrorMessage(error));
      return false;
    }
  }

  function clearWriteError() {
    setWriteError(null);
  }

  async function save(
    entry: McpServerEntry | undefined,
    draft: McpServerDraft,
  ) {
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
    if (!(await writeEdits(edits))) return false;
    await reloadAfterWrite(draft.name, false);
    return true;
  }

  async function importJson(entries: McpServerJsonImportEntry[]) {
    const edits: v2.ConfigEdit[] = entries.map((entry) => ({
      keyPath: mcpServerKeyPath(entry.name),
      value: entry.value,
      mergeStrategy: "replace",
    }));
    if (!(await writeEdits(edits))) return false;
    const firstEntry = entries[0];
    if (firstEntry) await reloadAfterWrite(firstEntry.name, false);
    return true;
  }

  async function setEnabled(entry: McpServerEntry, enabled: boolean) {
    if (!entry.draft) return;
    const edits: v2.ConfigEdit[] = [
      {
        keyPath: mcpServerKeyPath(entry.name),
        value: serializeMcpServerDraft({ ...entry.draft, enabled }, entry.raw),
        mergeStrategy: "replace",
      },
    ];
    if (!(await writeEdits(edits))) return;
    await reloadAfterWrite(entry.name, false);
  }

  async function deleteEntry(entry: McpServerEntry) {
    const edits: v2.ConfigEdit[] = [
      {
        keyPath: mcpServerKeyPath(entry.name),
        value: null,
        mergeStrategy: "replace",
      },
    ];
    if (!(await writeEdits(edits))) return;
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

  return {
    deleteEntry,
    clearWriteError,
    higherLayerNotice,
    importJson,
    overrideNotice,
    reloadError,
    reloadMcp,
    retryReload,
    save,
    setEnabled,
    writeConfig,
    writeError,
  };
}
