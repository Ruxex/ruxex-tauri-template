import { useTranslation } from "react-i18next";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useState } from "react";
import {
  type McpServerDraft,
  type McpServerJsonImportEntry,
  parseMcpServerDictionaryJson,
} from "../../app-server/mcp-config";
import {
  DialogFooter,
  DialogHeader,
} from "../../components/common/DialogParts";
import { handleTabListKeyDown } from "../../components/common/tab-keyboard";
import { useNativeModalDialog } from "../../components/common/useNativeModalDialog";
import {
  formStateToDraft,
  type McpServerFormState,
  switchMcpServerTransport,
  validateMcpServerForm,
} from "./mcp-server-form";

export function McpServerDialog({
  existingNames,
  form,
  isEditing,
  isPending,
  error,
  originalName,
  onClose,
  onDelete,
  onImportJson,
  onSubmit,
}: {
  existingNames: string[];
  form: McpServerFormState;
  isEditing: boolean;
  isPending: boolean;
  error: string | null;
  originalName?: string;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (draft: McpServerDraft) => void;
  onImportJson: (entries: McpServerJsonImportEntry[]) => void;
}) {
  const { t } = useTranslation("mcp");
  const dialogRef = useNativeModalDialog();
  const [localForm, setLocalForm] = useState(form);
  const [invalidForm, setInvalidForm] = useState<McpServerFormState | null>(
    null,
  );
  const validationErrors = invalidForm
    ? validateMcpServerForm(invalidForm, existingNames, originalName)
    : {};
  const [inputMode, setInputMode] = useState<"fields" | "json">("fields");
  const [jsonText, setJsonText] = useState("");
  const [invalidJson, setInvalidJson] = useState<string | null>(null);
  const jsonError =
    invalidJson === null ? null : validateJsonImport(invalidJson).error;

  function validateJsonImport(value: string) {
    const result = parseMcpServerDictionaryJson(value);
    if (result.error) return result;
    const conflicts = result.entries
      .map((entry) => entry.name)
      .filter((name) => existingNames.includes(name));
    return conflicts.length > 0
      ? {
          entries: [],
          error: t("alreadyConfigured", {
            names: conflicts.map((name) => `“${name}”`).join(", "),
          }),
        }
      : result;
  }
  const title = isEditing ? t("editMcpServer") : t("addMcpServer");

  function updateForm(patch: Partial<McpServerFormState>) {
    setLocalForm((current) => ({ ...current, ...patch }));
  }

  function updateDraft(patch: Partial<McpServerDraft>) {
    setLocalForm((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEditing && inputMode === "json") {
      const result = validateJsonImport(jsonText);
      if (result.error) {
        setInvalidJson(jsonText);
        return;
      }
      onImportJson(result.entries);
      return;
    }

    const formToSubmit = localForm;
    const errors = validateMcpServerForm(
      formToSubmit,
      existingNames,
      originalName,
    );
    setInvalidForm(formToSubmit);
    if (Object.keys(errors).length > 0) {
      return;
    }
    onSubmit(formStateToDraft(formToSubmit));
  }

  function switchInputMode(mode: "fields" | "json") {
    if (mode === inputMode) return;
    setInvalidJson(null);
    setInputMode(mode);
  }

  return (
    <dialog
      aria-labelledby="mcp-server-dialog-title"
      className="modal"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl px-5 py-7">
        <DialogHeader
          closeLabel={t("closeMcpServerDialog")}
          disabled={isPending}
          onClose={onClose}
          title={title}
          titleId="mcp-server-dialog-title"
        />

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div
            className={`${isEditing ? "overflow-hidden rounded-box border border-base-300 bg-base-100" : "attached-tabs"} sm:col-span-2`}
          >
            {!isEditing && (
              <div
                aria-label={t("mcpServerConfigurationMode")}
                className="attached-tablist"
                onKeyDown={handleTabListKeyDown}
                role="tablist"
              >
                <button
                  aria-selected={inputMode === "fields"}
                  className="attached-tab"
                  id="mcp-fields-tab"
                  tabIndex={inputMode === "fields" ? 0 : -1}
                  role="tab"
                  type="button"
                  onClick={() => switchInputMode("fields")}
                >
                  {t("fields")}
                </button>
                <button
                  aria-selected={inputMode === "json"}
                  className="attached-tab"
                  id="mcp-json-tab"
                  tabIndex={inputMode === "json" ? 0 : -1}
                  role="tab"
                  type="button"
                  onClick={() => switchInputMode("json")}
                >
                  JSON
                </button>
              </div>
            )}

            {!isEditing && inputMode === "json" ? (
              <div
                aria-labelledby="mcp-json-tab"
                className="attached-tabpanel grid gap-2 p-4"
                id="mcp-json-panel"
                role="tabpanel"
              >
                <textarea
                  aria-label={t("mcpServerJson")}
                  className="textarea textarea-bordered min-h-72 w-full font-mono text-sm"
                  placeholder={
                    '{\n  "server-name": {\n    "command": "npx",\n    "args": []\n  }\n}'
                  }
                  spellCheck={false}
                  value={jsonText}
                  onChange={(event) => {
                    setJsonText(event.target.value);
                    setInvalidJson(null);
                  }}
                />
                {jsonError && (
                  <span className="text-sm text-error" role="alert">
                    {jsonError}
                  </span>
                )}
              </div>
            ) : (
              <div
                aria-labelledby="mcp-fields-tab"
                className={`${isEditing ? "" : "attached-tabpanel"} grid gap-4 p-4 sm:grid-cols-2`}
                id="mcp-fields-panel"
                role="tabpanel"
              >
                <label className="form-control sm:col-span-2">
                  <span className="label-text">{t("serverName")}</span>
                  <input
                    aria-label={t("serverName")}
                    className="input input-bordered mt-1 w-full"
                    value={localForm.draft.name}
                    onChange={(event) =>
                      updateDraft({ name: event.target.value })
                    }
                  />
                  {validationErrors.name && (
                    <span className="mt-1 text-sm text-error" role="alert">
                      {validationErrors.name}
                    </span>
                  )}
                </label>

                <label className="form-control sm:col-span-2">
                  <span className="label-text">{t("transport")}</span>
                  <select
                    aria-label={t("transport")}
                    className="select select-bordered mt-1 w-full"
                    value={localForm.draft.transport}
                    onChange={(event) =>
                      setLocalForm((current) =>
                        switchMcpServerTransport(
                          current,
                          event.target.value as McpServerDraft["transport"],
                        ),
                      )
                    }
                  >
                    <option value="stdio">stdio</option>
                    <option value="streamableHttp">Streamable HTTP</option>
                  </select>
                </label>

                {localForm.draft.transport === "stdio" ? (
                  <>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">{t("command")}</span>
                      <input
                        aria-label={t("command")}
                        className="input input-bordered mt-1 w-full"
                        value={localForm.draft.command}
                        onChange={(event) =>
                          updateDraft({ command: event.target.value })
                        }
                      />
                      {validationErrors.command && (
                        <span className="mt-1 text-sm text-error" role="alert">
                          {validationErrors.command}
                        </span>
                      )}
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">{t("arguments")}</span>
                      <textarea
                        aria-label={t("arguments")}
                        className="textarea textarea-bordered mt-1 min-h-20 w-full"
                        placeholder={t("oneArgumentPerLine")}
                        value={localForm.argsText}
                        onChange={(event) =>
                          updateForm({ argsText: event.target.value })
                        }
                      />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">
                        {t("workingDirectory")}
                      </span>
                      <input
                        aria-label={t("workingDirectory")}
                        className="input input-bordered mt-1 w-full"
                        value={localForm.draft.cwd}
                        onChange={(event) =>
                          updateDraft({ cwd: event.target.value })
                        }
                      />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">
                        {t("environmentVariables")}
                      </span>
                      <textarea
                        aria-label={t("environmentVariables")}
                        className="textarea textarea-bordered mt-1 min-h-20 w-full"
                        placeholder={t("tokenOrTokenRemoteOnePerLine")}
                        value={localForm.envVarsText}
                        onChange={(event) =>
                          updateForm({ envVarsText: event.target.value })
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">URL</span>
                      <input
                        aria-label="URL"
                        className="input input-bordered mt-1 w-full"
                        value={localForm.draft.url}
                        onChange={(event) =>
                          updateDraft({ url: event.target.value })
                        }
                      />
                      {validationErrors.url && (
                        <span className="mt-1 text-sm text-error" role="alert">
                          {validationErrors.url}
                        </span>
                      )}
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">
                        {t("bearerTokenEnvironmentVariable")}
                      </span>
                      <input
                        aria-label={t("bearerTokenEnvironmentVariable")}
                        className="input input-bordered mt-1 w-full"
                        value={localForm.draft.bearerTokenEnvVar}
                        onChange={(event) =>
                          updateDraft({ bearerTokenEnvVar: event.target.value })
                        }
                      />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text">
                        {t("environmentbackedHeaders")}
                      </span>
                      <textarea
                        aria-label={t("environmentbackedHeaders")}
                        className="textarea textarea-bordered mt-1 min-h-20 w-full"
                        placeholder={t("xworkspaceworkspaceidOnePerLine")}
                        value={localForm.envHeadersText}
                        onChange={(event) =>
                          updateForm({ envHeadersText: event.target.value })
                        }
                      />
                    </label>
                  </>
                )}

                <div className="grid gap-2 rounded-lg border border-base-300 px-3 py-3 sm:col-span-2 sm:grid-cols-2">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      aria-label={t("enabled")}
                      checked={localForm.draft.enabled}
                      className="toggle toggle-primary toggle-sm"
                      type="checkbox"
                      onChange={(event) =>
                        updateDraft({ enabled: event.target.checked })
                      }
                    />
                    <span className="label-text">{t("enabled")}</span>
                  </label>
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      aria-label={t("required")}
                      checked={localForm.draft.required}
                      className="toggle toggle-primary toggle-sm"
                      type="checkbox"
                      onChange={(event) =>
                        updateDraft({ required: event.target.checked })
                      }
                    />
                    <span className="label-text">{t("required")}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-error sm:col-span-2" role="alert">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <DialogFooter>
              {isEditing && onDelete && (
                <button
                  aria-label={t("deleteNamedServer", {
                    name: originalName ?? localForm.draft.name,
                  })}
                  className="btn btn-ghost mr-auto text-error"
                  disabled={isPending}
                  type="button"
                  onClick={onDelete}
                >
                  <TrashIcon aria-hidden="true" className="size-4" />
                  {t("delete")}
                </button>
              )}
              <button
                aria-label={t("cancel")}
                className="btn btn-ghost"
                disabled={isPending}
                type="button"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                aria-label={
                  isPending
                    ? t("saving")
                    : isEditing
                      ? t("saveChanges")
                      : inputMode === "json"
                        ? t("importMcpServers")
                        : t("addMcpServer")
                }
                className="btn btn-primary gap-2"
                disabled={isPending}
                type="submit"
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                {isPending
                  ? t("saving")
                  : isEditing
                    ? t("saveChanges")
                    : inputMode === "json"
                      ? t("importMcpServers")
                      : t("addMcpServer")}
              </button>
            </DialogFooter>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          aria-label={t("closeMcpServerDialog")}
          type="button"
          onClick={onClose}
        >
          {t("close")}
        </button>
      </form>
    </dialog>
  );
}
