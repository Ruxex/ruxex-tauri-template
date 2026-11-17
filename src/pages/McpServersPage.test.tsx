// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GlobalMcpConfig,
  McpServerDraft,
  McpServerEntry,
} from "../app-server/mcp-config";
import { McpServersPage } from "./McpServersPage";

const useAllMcpServerStatus = vi.hoisted(() => vi.fn());
const useGlobalMcpConfig = vi.hoisted(() => vi.fn());
const useReloadMcpServers = vi.hoisted(() => vi.fn());
const useWriteConfig = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({
  useAllMcpServerStatus,
  useGlobalMcpConfig,
  useReloadMcpServers,
  useWriteConfig,
}));

function draft(overrides: Partial<McpServerDraft> = {}) {
  return {
    name: "docs",
    enabled: true,
    required: false,
    transport: "stdio" as const,
    command: "node",
    args: [],
    cwd: "",
    envVars: [],
    url: "",
    bearerTokenEnvVar: "",
    envHttpHeaders: {},
    ...overrides,
  };
}

function entry(overrides: Partial<McpServerEntry> = {}): McpServerEntry {
  return {
    name: "docs",
    raw: { command: "node", oauth: { client_id: "keep" } },
    draft: draft(),
    error: null,
    ...overrides,
  };
}

function config(overrides: Partial<GlobalMcpConfig> = {}) {
  return {
    data: { servers: [], version: "user-v1", ...overrides },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function status(names: string[] = []) {
  return {
    data: {
      data: names.map((name) => ({
        name,
        runtimeStatus: "connected",
        authStatus: "loggedIn",
        tools: { search: {} },
        toolsError: null,
      })),
      nextCursor: null,
    },
    isLoading: false,
    isError: false,
    error: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <McpServersPage />
    </MemoryRouter>,
  );
}

import { i18n } from "../app/i18n";

describe("McpServersPage", () => {
  it("renders Japanese MCP settings and dialog controls", async () => {
    await i18n.changeLanguage("ja");
    renderPage();
    expect(screen.getByRole("heading", { name: "MCP サーバー" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "MCP サーバーを追加" }));
    expect(screen.getByLabelText("サーバー名")).toBeTruthy();
    expect(screen.getByLabelText("コマンド")).toBeTruthy();
  });

  beforeEach(() => {
    useGlobalMcpConfig.mockReset().mockReturnValue(config());
    useAllMcpServerStatus.mockReset().mockReturnValue(status());
    useWriteConfig.mockReset().mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ status: "ok" }),
      isPending: false,
    });
    useReloadMcpServers.mockReset().mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the global empty state and opens the add dialog", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "MCP servers" })).toBeTruthy();
    expect(screen.queryByText("Global MCP configuration")).toBeNull();
    expect(
      screen.queryByText(
        "Manage the MCP servers in your global user configuration.",
      ),
    ).toBeNull();
    expect(screen.getByText("No global MCP servers configured.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    expect(
      screen.getByRole("heading", { name: "Add MCP server" }),
    ).toBeTruthy();
  });

  it("keeps runtime resources out of the compact server list", () => {
    const resource = {
      name: "guide",
      title: "Guide",
      description: "Documentation",
      uri: "resource://guide",
      mimeType: "text/plain",
    };
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue({
      ...status(["docs"]),
      data: {
        data: [
          {
            name: "docs",
            runtimeStatus: "connected",
            authStatus: "loggedIn",
            tools: { search: {} },
            toolsError: null,
            resources: [resource],
            resourceTemplates: [
              {
                name: "dynamic-guide",
                uriTemplate: "resource://guide/{section}",
                description: "Dynamic guide",
              },
            ],
          },
        ],
        nextCursor: null,
      },
    });
    renderPage();

    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByText("Resources (1)")).toBeNull();
    expect(screen.queryByText("dynamic-guide")).toBeNull();
  });

  it("shows each server with its status, configure action, and enable toggle", () => {
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue(status(["docs"]));

    renderPage();

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Configure docs" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Enable MCP server: docs" }),
    ).toBeTruthy();
  });

  it("writes the MCP server enabled state from the summary toggle", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    const reload = vi.fn().mockResolvedValue({});
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue(status(["docs"]));
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    useReloadMcpServers.mockReturnValue({
      mutateAsync: reload,
      isPending: false,
    });

    renderPage();
    fireEvent.click(
      screen.getByRole("switch", { name: "Enable MCP server: docs" }),
    );

    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        edits: [
          expect.objectContaining({
            keyPath: 'mcp_servers."docs"',
            value: expect.objectContaining({ enabled: false }),
          }),
        ],
      }),
    );
  });

  it("shows the authentication state when runtime connection state is unavailable", () => {
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue({
      ...status(["docs"]),
      data: {
        data: [
          {
            name: "docs",
            runtimeStatus: null,
            authStatus: "notLoggedIn",
            tools: {},
            toolsError: null,
            resources: [
              {
                name: "guide",
                title: "Guide",
                description: null,
                uri: "resource://guide",
                mimeType: "text/plain",
              },
            ],
            resourceTemplates: [],
          },
        ],
        nextCursor: null,
      },
    });

    renderPage();

    expect(screen.getByText("Unauthenticated")).toBeTruthy();
    expect(screen.queryByText("Status unavailable")).toBeNull();
    expect(screen.queryByText("Authentication not configured")).toBeNull();
  });

  it("keeps the configured state in the server row", () => {
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue(status(["docs"]));

    renderPage();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByText("Needs attention")).toBeNull();
    expect(screen.getByRole("switch", { name: "Enable MCP server: docs" })).toBeTruthy();
  });

  it("returns focus to the add trigger when the dialog closes", async () => {
    renderPage();
    const trigger = screen.getByRole("button", { name: "Add MCP server" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("writes a new global server and reloads MCP", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    const reload = vi.fn().mockResolvedValue({});
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    useReloadMcpServers.mockReturnValue({
      mutateAsync: reload,
      isPending: false,
    });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "npx" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add MCP server" })[1],
    );

    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledWith({
      edits: [
        {
          keyPath: 'mcp_servers."docs"',
          value: { command: "npx" },
          mergeStrategy: "replace",
        },
      ],
      reloadUserConfig: true,
      expectedVersion: "user-v1",
    });
    expect(reload).toHaveBeenCalledWith({});
  });

  it("preserves unknown fields and writes an atomic rename", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Configure docs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(write.mock.calls[0][0]).toMatchObject({
      edits: [
        {
          keyPath: 'mcp_servers."docs-new"',
          value: { command: "node", oauth: { client_id: "keep" } },
        },
        {
          keyPath: 'mcp_servers."docs"',
          value: null,
          mergeStrategy: "replace",
        },
      ],
      expectedVersion: "user-v1",
    });
  });

  it("shows the higher-layer override message from a successful write", async () => {
    const write = vi.fn().mockResolvedValue({
      status: "okOverridden",
      overriddenMetadata: { message: "Managed policy overrides this value." },
    });
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "node" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add MCP server" })[1],
    );

    await waitFor(() =>
      expect(
        screen.getByText("Managed policy overrides this value."),
      ).toBeTruthy(),
    );
  });

  it("confirms deletion and warns when another layer remains active", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    const refetch = vi.fn().mockResolvedValue({
      data: { data: [{ name: "docs" }] },
    });
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue({ ...status(["docs"]), refetch });
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Configure docs" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete docs" }));

    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(write.mock.calls[0][0].edits).toEqual([
      {
        keyPath: 'mcp_servers."docs"',
        value: null,
        mergeStrategy: "replace",
      },
    ]);
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(
      screen.getByText(/another configuration source is still active/i),
    ).toBeTruthy();
  });

  it("uses refreshed runtime status before showing a higher-layer delete warning", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    const refetch = vi.fn().mockResolvedValue({ data: { data: [] } });
    useGlobalMcpConfig.mockReturnValue(config({ servers: [entry()] }));
    useAllMcpServerStatus.mockReturnValue({ ...status(["docs"]), refetch });
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Configure docs" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete docs" }));

    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(
      screen.queryByText(/another configuration source is still active/i),
    ).toBeNull();
  });

  it("keeps the dialog open on a version conflict", async () => {
    const refetch = vi.fn();
    const writeError = {
      data: { config_write_error_code: "configVersionConflict" },
      message: "Configuration changed",
    };
    const write = vi.fn().mockRejectedValueOnce(writeError);
    useGlobalMcpConfig.mockReturnValue({ ...config(), refetch });
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "node" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add MCP server" })[1],
    );

    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("heading", { name: "Add MCP server" }),
    ).toBeTruthy();
  });

  it("shows a saved-but-reload-failed warning", async () => {
    const write = vi.fn().mockResolvedValue({ status: "ok" });
    const failedReload = vi
      .fn()
      .mockRejectedValueOnce(new Error("MCP reload failed"));
    useWriteConfig.mockReturnValue({ mutateAsync: write, isPending: false });
    useReloadMcpServers.mockReturnValue({
      mutateAsync: failedReload,
      isPending: false,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Server name" }), {
      target: { value: "docs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Command" }), {
      target: { value: "node" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add MCP server" })[1],
    );

    await waitFor(() =>
      expect(screen.getByText("Saved, but MCP reload failed")).toBeTruthy(),
    );
  });
  it.each([
    ["en", "Configure docs / server-1", "Delete docs / server-1"],
    ["ja", "docs / server-1 の設定", "docs / server-1 を削除"],
  ] as const)(
    "renders complete %s visible server action labels",
    async (language, editLabel, deleteLabel) => {
      await i18n.changeLanguage(language);
      const name = "docs / server-1";
      useGlobalMcpConfig.mockReturnValue(
        config({ servers: [entry({ name, draft: draft({ name }) })] }),
      );
      renderPage();
      expect(screen.getByRole("button", { name: editLabel })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: editLabel }));
      const deleteButton = screen.getByRole("button", { name: deleteLabel });
      expect(
        deleteButton.textContent,
      ).toBe(language === "en" ? "Delete" : "削除");
    },
  );
});
