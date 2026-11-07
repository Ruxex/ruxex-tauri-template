import { describe, expect, it } from "vitest";

import type { v2 } from "../protocol";
import {
  draftFromEntry,
  extractGlobalMcpConfig,
  mcpServerKeyPath,
  serializeMcpServerDraft,
  type McpServerDraft,
} from "./mcp-config";

function configResponse(
  layers: v2.ConfigLayer[] | null,
  config: v2.Config = {} as v2.Config,
): v2.ConfigReadResponse {
  return { config, layers, origins: {} };
}

function userLayer(
  config: Record<string, unknown>,
  version = "user-v1",
): v2.ConfigLayer {
  return {
    name: {
      type: "user",
      file: "/home/test/.ruxex/config.toml",
      profile: null,
    },
    version,
    config,
    disabledReason: null,
  } as v2.ConfigLayer;
}

function stdioDraft(overrides: Partial<McpServerDraft> = {}): McpServerDraft {
  return {
    name: "docs",
    enabled: true,
    required: false,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@example/docs"],
    cwd: "",
    envVars: [],
    url: "",
    bearerTokenEnvVar: "",
    envHttpHeaders: {},
    ...overrides,
  };
}

describe("global MCP configuration adapter", () => {
  it("extracts only MCP servers from the user layer", () => {
    const response = configResponse(
      [
        {
          name: { type: "system", file: "/etc/ruxex/config.toml" },
          version: "system-v1",
          config: { mcp_servers: { system: { url: "https://system" } } },
          disabledReason: null,
        },
        userLayer({ mcp_servers: { docs: { command: "npx" } } }),
        {
          name: { type: "project", dotRuxexFolder: "/workspace/.ruxex" },
          version: "project-v1",
          config: { mcp_servers: { project: { command: "project" } } },
          disabledReason: null,
        },
      ],
      {
        mcp_servers: { effective: { url: "https://effective" } },
      } as unknown as v2.Config,
    );

    const result = extractGlobalMcpConfig(response);

    expect(result.version).toBe("user-v1");
    expect(result.servers.map((server) => server.name)).toEqual(["docs"]);
  });

  it("returns an empty editable set when the user layer is absent", () => {
    const result = extractGlobalMcpConfig(
      configResponse([
        {
          name: { type: "system", file: "/etc/ruxex/config.toml" },
          version: "system-v1",
          config: { mcp_servers: { system: { url: "https://system" } } },
          disabledReason: null,
        },
      ]),
    );

    expect(result).toEqual({ servers: [], version: undefined });
  });

  it("quotes dots, quotes, and backslashes in a server key path", () => {
    expect(mcpServerKeyPath('a.b"c\\d')).toBe('mcp_servers."a.b\\"c\\\\d"');
  });

  it("normalizes environment variable references and reports malformed entries", () => {
    const result = extractGlobalMcpConfig(
      configResponse([
        userLayer({
          mcp_servers: {
            docs: {
              command: "node",
              env_vars: [
                "DOCS_TOKEN",
                { name: "REMOTE_TOKEN", source: "remote" },
              ],
            },
            broken: { enabled: "yes" },
          },
        }),
      ]),
    );

    const docs = result.servers.find((server) => server.name === "docs");
    const broken = result.servers.find((server) => server.name === "broken");

    expect(docs && draftFromEntry(docs)).toMatchObject({
      envVars: [
        { name: "DOCS_TOKEN", source: "" },
        { name: "REMOTE_TOKEN", source: "remote" },
      ],
    });
    expect(broken).toMatchObject({
      draft: null,
      error: expect.stringContaining("enabled"),
    });
  });

  it("preserves unsupported fields while overlaying an existing entry", () => {
    const response = configResponse([
      userLayer({
        mcp_servers: {
          docs: {
            command: "node",
            oauth: { client_id: "keep-me" },
            tools: { search: { approval_mode: "prompt" } },
          },
        },
      }),
    ]);
    const entry = extractGlobalMcpConfig(response).servers[0];
    const draft = draftFromEntry(entry);
    expect(draft).not.toBeNull();
    if (!draft) {
      throw new Error("expected a valid MCP draft");
    }

    const serialized = serializeMcpServerDraft(
      { ...draft, command: "bun" },
      entry.raw,
    );

    expect(serialized).toMatchObject({
      command: "bun",
      oauth: { client_id: "keep-me" },
      tools: { search: { approval_mode: "prompt" } },
    });
  });

  it("serializes new stdio and HTTP drafts without empty optional values", () => {
    expect(serializeMcpServerDraft(stdioDraft())).toEqual({
      command: "npx",
      args: ["-y", "@example/docs"],
    });

    expect(
      serializeMcpServerDraft({
        ...stdioDraft({
          name: "remote",
          transport: "streamableHttp",
          command: "",
          args: [],
          url: "https://example.com/mcp",
          bearerTokenEnvVar: "MCP_TOKEN",
          envHttpHeaders: { "X-Workspace": "WORKSPACE_ID" },
          enabled: false,
          required: true,
        }),
      }),
    ).toEqual({
      url: "https://example.com/mcp",
      bearer_token_env_var: "MCP_TOKEN",
      env_http_headers: { "X-Workspace": "WORKSPACE_ID" },
      enabled: false,
      required: true,
    });
  });

  it("removes incompatible transport fields when switching an existing entry", () => {
    const stdio = serializeMcpServerDraft(
      {
        name: "docs",
        enabled: true,
        required: false,
        transport: "stdio",
        command: "node",
        args: [],
        cwd: "",
        envVars: [],
        url: "",
        bearerTokenEnvVar: "",
        envHttpHeaders: {},
      },
      {
        url: "https://example.com/mcp",
        env_http_headers: { "X-Workspace": "WORKSPACE_ID" },
        oauth: { client_id: "keep" },
      },
    );
    const http = serializeMcpServerDraft(
      {
        name: "docs",
        enabled: true,
        required: false,
        transport: "streamableHttp",
        command: "",
        args: [],
        cwd: "",
        envVars: [],
        url: "https://example.com/mcp",
        bearerTokenEnvVar: "",
        envHttpHeaders: {},
      },
      {
        command: "node",
        args: ["server.js"],
        env_vars: ["TOKEN"],
        oauth: { client_id: "keep" },
      },
    );

    expect(stdio).toEqual({
      command: "node",
      oauth: { client_id: "keep" },
      enabled: true,
      required: false,
    });
    expect(http).toEqual({
      url: "https://example.com/mcp",
      oauth: { client_id: "keep" },
      enabled: true,
      required: false,
    });
  });
});
