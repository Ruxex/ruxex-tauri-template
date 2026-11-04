import type {
  McpEnvironmentVariableDraft,
  McpServerDraft,
  McpServerEntry,
  McpServerTransport,
} from "../../app-server/mcp-config";

export type McpServerFormState = {
  draft: McpServerDraft;
  argsText: string;
  envVarsText: string;
  envHeadersText: string;
};

export type McpServerFormErrors = Partial<
  Record<"name" | "command" | "url" | "envHeaders", string>
>;

function emptyDraft(): McpServerDraft {
  return {
    name: "",
    enabled: true,
    required: false,
    transport: "stdio",
    command: "",
    args: [],
    cwd: "",
    envVars: [],
    url: "",
    bearerTokenEnvVar: "",
    envHttpHeaders: {},
  };
}

function environmentVariablesToText(
  variables: McpEnvironmentVariableDraft[],
): string {
  return variables
    .map((variable) =>
      variable.source ? `${variable.name} (${variable.source})` : variable.name,
    )
    .join("\n");
}

function parseEnvironmentVariableLines(
  value: string,
): McpEnvironmentVariableDraft[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(.*?)\s+\((local|remote)\)$/.exec(line);
      return match
        ? { name: match[1].trim(), source: match[2] as "local" | "remote" }
        : { name: line, source: "" as const };
    })
    .filter((variable) => variable.name);
}

export function createMcpServerForm(
  initial?: McpServerDraft | McpServerEntry,
): McpServerFormState {
  const initialDraft = initial
    ? "draft" in initial
      ? initial.draft
      : initial
    : null;
  const draft = initialDraft ? { ...initialDraft } : emptyDraft();
  return {
    draft,
    argsText: draft.args.join("\n"),
    envVarsText: environmentVariablesToText(draft.envVars),
    envHeadersText: Object.entries(draft.envHttpHeaders)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n"),
  };
}

export function switchMcpServerTransport(
  form: McpServerFormState,
  transport: McpServerTransport,
): McpServerFormState {
  return {
    ...form,
    draft: { ...form.draft, transport },
  };
}

export function parseKeyValueLines(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator === -1
          ? [line, ""]
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
      .filter(([name]) => name),
  );
}

export function formStateToDraft(form: McpServerFormState): McpServerDraft {
  return {
    ...form.draft,
    name: form.draft.name.trim(),
    command: form.draft.command.trim(),
    cwd: form.draft.cwd.trim(),
    args: form.argsText
      .split("\n")
      .map((arg) => arg.trim())
      .filter(Boolean),
    envVars: parseEnvironmentVariableLines(form.envVarsText),
    url: form.draft.url.trim(),
    bearerTokenEnvVar: form.draft.bearerTokenEnvVar.trim(),
    envHttpHeaders: parseKeyValueLines(form.envHeadersText),
  };
}

export function validateMcpServerForm(
  form: McpServerFormState,
  existingNames: string[],
  originalName?: string,
): McpServerFormErrors {
  const draft = formStateToDraft(form);
  const errors: McpServerFormErrors = {};
  if (!draft.name) {
    errors.name = "Server name is required.";
  } else if (
    existingNames.includes(draft.name) &&
    draft.name !== originalName
  ) {
    errors.name = "A server with this name already exists.";
  }
  if (draft.transport === "stdio" && !draft.command) {
    errors.command = "Command is required for stdio servers.";
  }
  if (draft.transport === "streamableHttp" && !draft.url) {
    errors.url = "URL is required for HTTP servers.";
  }
  return errors;
}
