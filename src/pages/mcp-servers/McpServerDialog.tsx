import { PlusIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useState } from "react";
import type { McpServerDraft } from "../../app-server/mcp-config";
import {
  DialogFooter,
  DialogHeader,
} from "../../components/common/DialogParts";
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
  onSubmit,
}: {
  existingNames: string[];
  form: McpServerFormState;
  isEditing: boolean;
  isPending: boolean;
  error: string | null;
  originalName?: string;
  onClose: () => void;
  onSubmit: (draft: McpServerDraft) => void;
}) {
  const [localForm, setLocalForm] = useState(form);
  const [validationErrors, setValidationErrors] = useState(
    {} as ReturnType<typeof validateMcpServerForm>,
  );
  const title = isEditing ? "Edit MCP server" : "Add MCP server";

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
    const errors = validateMcpServerForm(
      localForm,
      existingNames,
      originalName,
    );
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    onSubmit(formStateToDraft(localForm));
  }

  return (
    <dialog
      aria-labelledby="mcp-server-dialog-title"
      className="modal"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl px-5 py-7">
        <DialogHeader
          closeLabel="Close MCP server dialog"
          disabled={isPending}
          onClose={onClose}
          title={title}
          titleId="mcp-server-dialog-title"
        />

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="form-control">
            <span className="label-text">Server name</span>
            <input
              aria-label="Server name"
              className="input input-bordered mt-1 w-full"
              value={localForm.draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
            {validationErrors.name && (
              <span className="mt-1 text-sm text-error" role="alert">
                {validationErrors.name}
              </span>
            )}
          </label>

          <label className="form-control">
            <span className="label-text">Transport</span>
            <select
              aria-label="Transport"
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
              <label className="form-control">
                <span className="label-text">Command</span>
                <input
                  aria-label="Command"
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
              <label className="form-control">
                <span className="label-text">Arguments</span>
                <textarea
                  aria-label="Arguments"
                  className="textarea textarea-bordered mt-1 min-h-20 w-full"
                  placeholder="One argument per line"
                  value={localForm.argsText}
                  onChange={(event) =>
                    updateForm({ argsText: event.target.value })
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text">Working directory</span>
                <input
                  aria-label="Working directory"
                  className="input input-bordered mt-1 w-full"
                  value={localForm.draft.cwd}
                  onChange={(event) => updateDraft({ cwd: event.target.value })}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Environment variables</span>
                <textarea
                  aria-label="Environment variables"
                  className="textarea textarea-bordered mt-1 min-h-20 w-full"
                  placeholder="TOKEN or TOKEN (remote), one per line"
                  value={localForm.envVarsText}
                  onChange={(event) =>
                    updateForm({ envVarsText: event.target.value })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label className="form-control">
                <span className="label-text">URL</span>
                <input
                  aria-label="URL"
                  className="input input-bordered mt-1 w-full"
                  value={localForm.draft.url}
                  onChange={(event) => updateDraft({ url: event.target.value })}
                />
                {validationErrors.url && (
                  <span className="mt-1 text-sm text-error" role="alert">
                    {validationErrors.url}
                  </span>
                )}
              </label>
              <label className="form-control">
                <span className="label-text">
                  Bearer token environment variable
                </span>
                <input
                  aria-label="Bearer token environment variable"
                  className="input input-bordered mt-1 w-full"
                  value={localForm.draft.bearerTokenEnvVar}
                  onChange={(event) =>
                    updateDraft({ bearerTokenEnvVar: event.target.value })
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text">Environment-backed headers</span>
                <textarea
                  aria-label="Environment-backed headers"
                  className="textarea textarea-bordered mt-1 min-h-20 w-full"
                  placeholder="X-Workspace=WORKSPACE_ID, one per line"
                  value={localForm.envHeadersText}
                  onChange={(event) =>
                    updateForm({ envHeadersText: event.target.value })
                  }
                />
              </label>
            </>
          )}

          <div className="grid gap-2 rounded-lg border border-base-300 px-3 py-3 sm:grid-cols-2">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                aria-label="Enabled"
                checked={localForm.draft.enabled}
                className="toggle toggle-primary toggle-sm"
                type="checkbox"
                onChange={(event) =>
                  updateDraft({ enabled: event.target.checked })
                }
              />
              <span className="label-text">Enabled</span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                aria-label="Required"
                checked={localForm.draft.required}
                className="toggle toggle-primary toggle-sm"
                type="checkbox"
                onChange={(event) =>
                  updateDraft({ required: event.target.checked })
                }
              />
              <span className="label-text">Required</span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              aria-label="Cancel"
              className="btn btn-ghost"
              disabled={isPending}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              aria-label={
                isPending
                  ? "Saving…"
                  : isEditing
                    ? "Save changes"
                    : "Add MCP server"
              }
              className="btn btn-primary gap-2"
              disabled={isPending}
              type="submit"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Add MCP server"}
            </button>
          </DialogFooter>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          aria-label="Close MCP server dialog"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </form>
    </dialog>
  );
}
