import { i18n } from "@/app/i18n";
import type { v2 } from "@/protocol";
import type { JsonValue } from "@/protocol/generated/serde_json/JsonValue";

export type McpServerTransport = "stdio" | "streamableHttp";

export type McpEnvironmentVariableDraft = {
  name: string;
  source: "" | "local" | "remote";
};

export type McpServerDraft = {
  name: string;
  enabled: boolean;
  required: boolean;
  transport: McpServerTransport;
  command: string;
  args: string[];
  cwd: string;
  envVars: McpEnvironmentVariableDraft[];
  url: string;
  bearerTokenEnvVar: string;
  envHttpHeaders: Record<string, string>;
};

type JsonObject = { [key: string]: JsonValue | undefined };

export type McpServerEntry = {
  name: string;
  raw: JsonObject;
  draft: McpServerDraft | null;
  error: string | null;
};

export type GlobalMcpConfig = {
  servers: McpServerEntry[];
  version?: string;
};

const STDIO_ONLY_KEYS = ["command", "args", "env", "env_vars", "cwd"] as const;

const HTTP_ONLY_KEYS = [
  "url",
  "bearer_token_env_var",
  "http_headers",
  "env_http_headers",
  "http_headers_helper",
] as const;

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function isBoolean(value: JsonValue | undefined): value is boolean {
  return typeof value === "boolean";
}

function readOptionalString(
  raw: JsonObject,
  key: string,
): { value: string; error?: never } | { value?: never; error: string } {
  const value = raw[key];
  if (value === undefined) {
    return { value: "" };
  }
  return isString(value)
    ? { value }
    : {
        error: i18n.t("fieldString", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: key,
        }),
      };
}

function readBoolean(
  raw: JsonObject,
  key: string,
  fallback: boolean,
): { value: boolean; error?: never } | { value?: never; error: string } {
  const value = raw[key];
  if (value === undefined) {
    return { value: fallback };
  }
  return isBoolean(value)
    ? { value }
    : {
        error: i18n.t("fieldBoolean", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: key,
        }),
      };
}

function readStringArray(
  raw: JsonObject,
  key: string,
): { value: string[]; error?: never } | { value?: never; error: string } {
  const value = raw[key];
  if (value === undefined) {
    return { value: [] };
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return {
      error: i18n.t("fieldStringArray", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
        field: key,
      }),
    };
  }
  return { value };
}

function readEnvironmentVariables(
  raw: JsonObject,
): { value: McpEnvironmentVariableDraft[]; error?: never } | { value?: never; error: string } {
  const value = raw.env_vars;
  if (value === undefined) {
    return { value: [] };
  }
  if (!Array.isArray(value)) {
    return {
      error: i18n.t("envVarsArray", { ns: "mcp", lng: i18n.resolvedLanguage }),
    };
  }

  const variables: McpEnvironmentVariableDraft[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      variables.push({ name: item, source: "" });
      continue;
    }
    if (!isJsonObject(item) || typeof item.name !== "string") {
      return {
        error: i18n.t("envVarsEntries", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
        }),
      };
    }
    const source = item.source;
    if (source !== undefined && source !== "local" && source !== "remote") {
      return {
        error: i18n.t("envVarsSource", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
        }),
      };
    }
    variables.push({
      name: item.name,
      source: source ?? "",
    });
  }
  return { value: variables };
}

function readEnvironmentHeaders(
  raw: JsonObject,
): { value: Record<string, string>; error?: never } | { value?: never; error: string } {
  const value = raw.env_http_headers;
  if (value === undefined) {
    return { value: {} };
  }
  if (!isJsonObject(value)) {
    return {
      error: i18n.t("envHeadersObject", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      }),
    };
  }
  const headers: Record<string, string> = {};
  for (const [name, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== "string") {
      return {
        error: i18n.t("envHeadersStrings", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
        }),
      };
    }
    headers[name] = headerValue;
  }
  return { value: headers };
}

function normalizeEntry(name: string, raw: JsonObject): McpServerEntry {
  const enabled = readBoolean(raw, "enabled", true);
  if ("error" in enabled) {
    return {
      name,
      raw,
      draft: null,
      error:
        enabled.error ??
        i18n.t("fieldBoolean", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: "enabled",
        }),
    };
  }
  const hasCommand = raw.command !== undefined;
  const hasUrl = raw.url !== undefined;
  if (hasCommand === hasUrl) {
    return {
      name,
      raw,
      draft: null,
      error: i18n.t("exactlyOneTransport", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      }),
    };
  }

  if (hasCommand) {
    const command = readOptionalString(raw, "command");
    if ("error" in command) {
      return {
        name,
        raw,
        draft: null,
        error:
          command.error ??
          i18n.t("fieldString", {
            ns: "mcp",
            lng: i18n.resolvedLanguage,
            field: "command",
          }),
      };
    }
    const args = readStringArray(raw, "args");
    if ("error" in args) {
      return {
        name,
        raw,
        draft: null,
        error:
          args.error ??
          i18n.t("fieldStringArray", {
            ns: "mcp",
            lng: i18n.resolvedLanguage,
            field: "args",
          }),
      };
    }
    const cwd = readOptionalString(raw, "cwd");
    if ("error" in cwd) {
      return {
        name,
        raw,
        draft: null,
        error:
          cwd.error ??
          i18n.t("fieldString", {
            ns: "mcp",
            lng: i18n.resolvedLanguage,
            field: "cwd",
          }),
      };
    }
    const envVars = readEnvironmentVariables(raw);
    if ("error" in envVars) {
      return {
        name,
        raw,
        draft: null,
        error:
          envVars.error ??
          i18n.t("fieldInvalid", {
            ns: "mcp",
            lng: i18n.resolvedLanguage,
            field: "env_vars",
          }),
      };
    }
    return {
      name,
      raw,
      error: null,
      draft: {
        name,
        enabled: enabled.value,
        required: false,
        transport: "stdio",
        command: command.value,
        args: args.value,
        cwd: cwd.value,
        envVars: envVars.value,
        url: "",
        bearerTokenEnvVar: "",
        envHttpHeaders: {},
      },
    };
  }

  const url = readOptionalString(raw, "url");
  if ("error" in url) {
    return {
      name,
      raw,
      draft: null,
      error:
        url.error ??
        i18n.t("fieldString", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: "url",
        }),
    };
  }
  const bearerTokenEnvVar = readOptionalString(raw, "bearer_token_env_var");
  if ("error" in bearerTokenEnvVar) {
    return {
      name,
      raw,
      draft: null,
      error:
        bearerTokenEnvVar.error ??
        i18n.t("fieldString", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: "bearer_token_env_var",
        }),
    };
  }
  const envHttpHeaders = readEnvironmentHeaders(raw);
  if ("error" in envHttpHeaders) {
    return {
      name,
      raw,
      draft: null,
      error:
        envHttpHeaders.error ??
        i18n.t("fieldInvalid", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          field: "env_http_headers",
        }),
    };
  }
  return {
    name,
    raw,
    error: null,
    draft: {
      name,
      enabled: enabled.value,
      required: false,
      transport: "streamableHttp",
      command: "",
      args: [],
      cwd: "",
      envVars: [],
      url: url.value,
      bearerTokenEnvVar: bearerTokenEnvVar.value,
      envHttpHeaders: envHttpHeaders.value,
    },
  };
}

export type McpServerJsonImportEntry = {
  name: string;
  value: JsonObject;
};

export function parseMcpServerDictionaryJson(value: string): {
  entries: McpServerJsonImportEntry[];
  error: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : i18n.t("invalidJson", { ns: "mcp", lng: i18n.resolvedLanguage }),
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      entries: [],
      error: i18n.t("dictionaryObject", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      }),
    };
  }

  const root = parsed as JsonObject;
  const serverDictionary = ["mcpServers", "mcp_servers", "servers"]
    .map((key) => root[key])
    .find((candidate) => {
      return isJsonObject(candidate) && !("command" in candidate) && !("url" in candidate);
    }) as JsonObject | undefined;
  const configs = serverDictionary ?? root;

  const entries: McpServerJsonImportEntry[] = [];
  for (const [name, value] of Object.entries(configs)) {
    if (!name.trim() || name !== name.trim()) {
      return {
        entries: [],
        error: i18n.t("serverNamesUnpadded", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
        }),
      };
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return {
        entries: [],
        error: i18n.t("namedConfigObject", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          name,
        }),
      };
    }

    const config = value as JsonObject;
    const entry = normalizeEntry(name, config);
    if (!entry.draft) {
      return {
        entries: [],
        error: i18n.t("namedConfigInvalid", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          name,
          details: entry.error,
        }),
      };
    }
    if (entry.draft.transport === "stdio" && !entry.draft.command.trim()) {
      return {
        entries: [],
        error: i18n.t("namedConfigCommand", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          name,
        }),
      };
    }
    if (entry.draft.transport === "streamableHttp" && !entry.draft.url.trim()) {
      return {
        entries: [],
        error: i18n.t("namedConfigUrl", {
          ns: "mcp",
          lng: i18n.resolvedLanguage,
          name,
        }),
      };
    }
    entries.push({ name, value: { ...config, required: false } });
  }

  if (entries.length === 0) {
    return {
      entries: [],
      error: i18n.t("atLeastOneServer", {
        ns: "mcp",
        lng: i18n.resolvedLanguage,
      }),
    };
  }
  return { entries, error: null };
}

export function extractGlobalMcpConfig(response: v2.ConfigReadResponse): GlobalMcpConfig {
  const layer = response.layers?.find((candidate) => candidate.name.type === "user");
  if (!layer || !isJsonObject(layer.config)) {
    return { servers: [], version: undefined };
  }
  const rawServers = layer.config.mcp_servers;
  if (!isJsonObject(rawServers)) {
    return { servers: [], version: layer.version };
  }

  return {
    version: layer.version,
    servers: Object.entries(rawServers).map(([name, value]) =>
      isJsonObject(value)
        ? normalizeEntry(name, value)
        : {
            name,
            raw: {},
            draft: null,
            error: i18n.t("serverConfigObject", {
              ns: "mcp",
              lng: i18n.resolvedLanguage,
            }),
          },
    ),
  };
}

export function draftFromEntry(entry: McpServerEntry): McpServerDraft | null {
  return entry.draft;
}

export function mcpServerKeyPath(name: string): string {
  const escaped = name.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `mcp_servers."${escaped}"`;
}

function assignIfNonEmpty(target: JsonObject, key: string, value: string): void {
  if (value.trim()) {
    target[key] = value;
  } else {
    delete target[key];
  }
}

function serializeEnvironmentVariables(variables: McpEnvironmentVariableDraft[]): JsonValue[] {
  return variables
    .filter((variable) => variable.name.trim())
    .map((variable) =>
      variable.source ? { name: variable.name.trim(), source: variable.source } : variable.name.trim(),
    );
}

export function serializeMcpServerDraft(draft: McpServerDraft, original?: JsonObject): JsonObject {
  const serialized: JsonObject = { ...(original ?? {}) };

  if (draft.transport === "stdio") {
    for (const key of HTTP_ONLY_KEYS) {
      delete serialized[key];
    }
    serialized.command = draft.command.trim();
    if (draft.args.length) {
      serialized.args = draft.args.map((arg) => arg.trim()).filter(Boolean);
    } else {
      delete serialized.args;
    }
    if (draft.envVars.length) {
      serialized.env_vars = serializeEnvironmentVariables(draft.envVars);
    } else {
      delete serialized.env_vars;
    }
    assignIfNonEmpty(serialized, "cwd", draft.cwd);
  } else {
    for (const key of STDIO_ONLY_KEYS) {
      delete serialized[key];
    }
    assignIfNonEmpty(serialized, "url", draft.url);
    assignIfNonEmpty(serialized, "bearer_token_env_var", draft.bearerTokenEnvVar);
    if (Object.keys(draft.envHttpHeaders).length) {
      serialized.env_http_headers = Object.fromEntries(
        Object.entries(draft.envHttpHeaders)
          .map(([name, value]) => [name.trim(), value.trim()])
          .filter(([name, value]) => name && value),
      );
    } else {
      delete serialized.env_http_headers;
    }
  }

  if (original) {
    serialized.enabled = draft.enabled;
    serialized.required = false;
  } else {
    if (draft.enabled) {
      delete serialized.enabled;
    } else {
      serialized.enabled = false;
    }
    serialized.required = false;
  }

  return serialized;
}
