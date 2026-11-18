// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/app/i18n";
import type { McpServerDraft } from "@/app-server/mcp-config";
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
        onImportJson={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add MCP server" })).toBeTruthy();
    expect(screen.queryByLabelText("Required")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "npx" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Add MCP server" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "docs", command: "npx" }));
  });

  it("switches transport fields and preserves edit input on an error", () => {
    const form = createMcpServerForm(draft({ name: "docs", command: "node", transport: "stdio" }));
    render(
      <McpServerDialog
        existingNames={["docs"]}
        form={form}
        isEditing
        isPending={false}
        error="The server configuration is invalid."
        onClose={vi.fn()}
        onImportJson={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit MCP server" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Command" }) as HTMLInputElement).value).toBe("node");
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
        onImportJson={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getAllByRole("button", { name: "Close MCP server dialog" })[1]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates validation language while retaining the edited draft and focused input", async () => {
    render(
      <McpServerDialog
        existingNames={[]}
        form={createMcpServerForm()}
        isEditing={false}
        isPending={false}
        error={null}
        onClose={() => undefined}
        onImportJson={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const command = screen.getByLabelText("Command") as HTMLInputElement;
    fireEvent.change(command, {
      target: { value: "node /workspace/server.js" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    expect(screen.getByText("Server name is required.")).toBeTruthy();
    command.focus();
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    expect(screen.getByText("サーバー名は必須です。")).toBeTruthy();
    expect(screen.getByLabelText("コマンド")).toBe(command);
    expect(command.value).toBe("node /workspace/server.js");
    expect(document.activeElement).toBe(command);
  });
});
