import { describe, expect, it } from "vitest";

import type { McpServerDraft } from "../../app-server/mcp-config";
import {
  createMcpServerForm,
  formStateToDraft,
  parseKeyValueLines,
  switchMcpServerTransport,
  validateMcpServerForm,
} from "./mcp-server-form";

function draft(overrides: Partial<McpServerDraft> = {}): McpServerDraft {
  return {
    name: "docs",
    enabled: true,
    required: false,
    transport: "stdio",
    command: "node",
    args: ["server.js"],
    cwd: "",
    envVars: [],
    url: "",
    bearerTokenEnvVar: "",
    envHttpHeaders: {},
    ...overrides,
  };
}

describe("MCP server form model", () => {
  it("creates a form and converts line-based fields into a draft", () => {
    const form = createMcpServerForm({
      ...draft(),
      args: ["server.js", "--stdio"],
      envHttpHeaders: { "X-Workspace": "WORKSPACE_ID" },
    });
    form.argsText = "server.js\n\n--stdio\n";
    form.envHeadersText = "X-Workspace=WORKSPACE_ID\n\n";

    expect(formStateToDraft(form)).toMatchObject({
      args: ["server.js", "--stdio"],
      envHttpHeaders: { "X-Workspace": "WORKSPACE_ID" },
    });
  });

  it("preserves transport-specific values when switching transports", () => {
    const form = createMcpServerForm(
      draft({ url: "https://example.com/mcp", transport: "stdio" }),
    );

    const switched = switchMcpServerTransport(form, "streamableHttp");

    expect(switched.draft.transport).toBe("streamableHttp");
    expect(switched.draft.url).toBe("https://example.com/mcp");
    expect(switched.argsText).toBe("server.js");
  });

  it("parses key-value header lines and ignores blank lines", () => {
    expect(parseKeyValueLines("X-One=ONE\n\nX-Two=TWO\n")).toEqual({
      "X-One": "ONE",
      "X-Two": "TWO",
    });
  });

  it("requires a name and the selected transport's endpoint", () => {
    const errors = validateMcpServerForm(
      createMcpServerForm(
        draft({ name: "", command: "", url: "", transport: "stdio" }),
      ),
      [],
    );

    expect(errors).toMatchObject({
      name: "Server name is required.",
      command: "Command is required for stdio servers.",
    });
  });

  it("rejects duplicate names except when editing the same entry", () => {
    const form = createMcpServerForm(draft({ name: "docs" }));

    expect(validateMcpServerForm(form, ["docs", "github"])).toMatchObject({
      name: "A server with this name already exists.",
    });
    expect(validateMcpServerForm(form, ["docs", "github"], "docs")).toEqual({});
  });
});
