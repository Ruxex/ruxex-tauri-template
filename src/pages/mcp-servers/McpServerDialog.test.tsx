// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { McpServerDraft } from "../../app-server/mcp-config";
import { createMcpServerForm } from "./mcp-server-form";
import { McpServerDialog } from "./McpServerDialog";

function draft(overrides: Partial<McpServerDraft> = {}): McpServerDraft {
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
    ...overrides,
  };
}

describe("McpServerDialog", () => {
  afterEach(cleanup);

  it("renders add controls and returns the edited draft", () => {
    const onSubmit = vi.fn();
    render(
      <McpServerDialog
        existingNames={[]}
        form={createMcpServerForm(draft())}
        isEditing={false}
        isPending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Add MCP server" }),
    ).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "npx" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Add MCP server" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "docs", command: "npx" }),
    );
  });

  it("switches transport fields and preserves edit input on an error", () => {
    const form = createMcpServerForm(
      draft({ name: "docs", command: "node", transport: "stdio" }),
    );
    render(
      <McpServerDialog
        existingNames={["docs"]}
        form={form}
        isEditing
        isPending={false}
        error="The server configuration is invalid."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit MCP server" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Command" }) as HTMLInputElement)
        .value,
    ).toBe("node");
    fireEvent.change(screen.getByRole("combobox", { name: "Transport" }), {
      target: { value: "streamableHttp" },
    });
    expect(screen.getByRole("textbox", { name: "URL" })).toBeTruthy();
    expect(screen.getByText("The server configuration is invalid.")).toBeTruthy();
  });

  it("disables save while pending and exposes an accessible close action", () => {
    const onClose = vi.fn();
    render(
      <McpServerDialog
        existingNames={[]}
        form={createMcpServerForm(draft())}
        isEditing={false}
        isPending
        error={null}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Close MCP server dialog" })[1],
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
