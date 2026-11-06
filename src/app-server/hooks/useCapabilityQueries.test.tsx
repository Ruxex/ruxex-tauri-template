// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestAppServerMethod = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ requestAppServerMethod }));
vi.mock("../queries", () => ({
  useAppServerStatus: () => ({ data: { appServerVersion: "test" } }),
}));

function createWrapper(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("capability query and mutation hooks", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockResolvedValue({ response: { data: [] } });
  });

  it.each([
    ["useSkillsList", "skills/list", { forceReload: true }],
    ["useMcpServerStatus", "mcpServerStatus/list", { limit: 10 }],
    ["usePluginList", "plugin/list", {}],
    [
      "usePluginRead",
      "plugin/read",
      { marketplacePath: "/tmp/community", pluginName: "example" },
    ],
    ["useCollaborationModes", "collaborationMode/list", {}],
    ["useConfig", "config/read", { includeLayers: true }],
    ["useConfigRequirements", "configRequirements/read", undefined],
  ] as const)("maps %s to %s", async (hookName, method, params) => {
    const hooks = await import("./useCapabilityQueries");
    const hook = hooks[hookName] as (value?: never) => { isSuccess: boolean };
    const { result } = renderHook(() => hook(params as never), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith(method, params);
  });

  it.each([
    [
      "useCallMcpTool",
      "mcpServer/tool/call",
      { threadId: "thread-1", server: "docs", tool: "search", arguments: {} },
    ],
    [
      "useAddMarketplace",
      "marketplace/add",
      {
        source: "https://example.com/marketplace.git",
        refName: "main",
        sparsePaths: ["plugins/example"],
      },
    ],
    [
      "useUpgradeMarketplace",
      "marketplace/upgrade",
      { marketplaceName: "community" },
    ],
    [
      "useRemoveMarketplace",
      "marketplace/remove",
      { marketplaceName: "community" },
    ],
    [
      "useInstallPlugin",
      "plugin/install",
      { marketplacePath: "/tmp/community", pluginName: "example" },
    ],
    [
      "useUninstallPlugin",
      "plugin/uninstall",
      { pluginId: "example@community" },
    ],
    ["useStartReview", "review/start", { threadId: "thread-1", target: {} }],
    [
      "useUpdateTurnSettings",
      "turn/settings/update",
      { threadId: "thread-1", turnId: "turn-1", effort: "high" },
    ],
    [
      "useMcpOauthLogin",
      "mcpServer/oauth/login",
      { name: "docs", scopes: ["read"] },
    ],
  ] as const)(
    "maps %s to %s and returns the server payload",
    async (hookName, method, params) => {
      const response = { accepted: true };
      requestAppServerMethod.mockResolvedValueOnce({ response });
      const hooks = await import("./useCapabilityQueries");
      const hook = hooks[hookName] as () => {
        mutateAsync: (value: never) => Promise<unknown>;
      };
      const { result } = renderHook(() => hook(), { wrapper: createWrapper() });

      await expect(
        act(async () => result.current.mutateAsync(params as never)),
      ).resolves.toEqual(response);
      expect(requestAppServerMethod).toHaveBeenCalledWith(method, params);
    },
  );

  it("invalidates MCP status after a successful reload", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useReloadMcpServers } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useReloadMcpServers(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.mutateAsync({}));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "mcp-servers"],
    });
  });

  it("reads the editable global MCP configuration from the user layer", async () => {
    requestAppServerMethod.mockResolvedValueOnce({
      response: {
        config: {},
        origins: {},
        layers: [
          {
            name: {
              type: "user",
              file: "/tmp/config.toml",
              profile: null,
            },
            version: "user-v1",
            config: { mcp_servers: { docs: { command: "node" } } },
            disabledReason: null,
          },
        ],
      },
    });
    const { useGlobalMcpConfig } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useGlobalMcpConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith("config/read", {
      includeLayers: true,
    });
    expect(result.current.data?.servers.map((server) => server.name)).toEqual([
      "docs",
    ]);
  });

  it("fetches all MCP status pages and combines them", async () => {
    requestAppServerMethod.mockImplementation(
      async (method: string, params: { cursor?: string }) => {
        if (method !== "mcpServerStatus/list") {
          return { response: { data: [] } };
        }
        if (params.cursor === "next") {
          return {
            response: {
              data: [{ name: "second" }],
              nextCursor: null,
            },
          };
        }
        return {
          response: {
            data: [{ name: "first" }],
            nextCursor: "next",
          },
        };
      },
    );
    const { useAllMcpServerStatus } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useAllMcpServerStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.map((server) => server.name)).toEqual([
      "first",
      "second",
    ]);
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      1,
      "mcpServerStatus/list",
      { detail: "full" },
    );
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      2,
      "mcpServerStatus/list",
      { detail: "full", cursor: "next" },
    );
  });

  it("writes config batches and invalidates config and MCP status", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useWriteConfig } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useWriteConfig(), {
      wrapper: createWrapper(client),
    });
    const params = {
      edits: [
        {
          keyPath: 'mcp_servers."docs"',
          value: { command: "node" },
          mergeStrategy: "replace" as const,
        },
      ],
      reloadUserConfig: true,
    };

    await act(async () => result.current.mutateAsync(params));

    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "config/batchWrite",
      params,
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "config"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "mcp-servers"],
    });
  });

  it.each([
    "useAddMarketplace",
    "useUpgradeMarketplace",
    "useRemoveMarketplace",
    "useInstallPlugin",
  ] as const)("invalidates plugins after %s succeeds", async (hookName) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const hooks = await import("./useCapabilityQueries");
    const hook = hooks[hookName] as () => {
      mutateAsync: (value: never) => Promise<unknown>;
    };
    const params = {
      useAddMarketplace: { source: "https://example.com/marketplace.git" },
      useUpgradeMarketplace: { marketplaceName: "community" },
      useRemoveMarketplace: { marketplaceName: "community" },
      useInstallPlugin: {
        marketplacePath: "/tmp/community",
        pluginName: "example",
      },
    }[hookName];

    const { result } = renderHook(() => hook(), {
      wrapper: createWrapper(client),
    });
    await act(async () => result.current.mutateAsync(params as never));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "plugins"],
    });
  });

  it("invalidates related capability queries after plugin uninstall", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useUninstallPlugin } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useUninstallPlugin(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({ pluginId: "example@community" }),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "plugins"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "skills"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "mcp-servers"],
    });
  });

  it("invalidates config after marketplace mutations succeed", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useAddMarketplace } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useAddMarketplace(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({
        source: "https://example.com/community.git",
      }),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "config"],
    });
  });

  it("propagates MCP tool errors without inventing a successful result", async () => {
    requestAppServerMethod.mockRejectedValueOnce(new Error("MCP unavailable"));
    const { useCallMcpTool } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useCallMcpTool(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          threadId: "thread-1",
          server: "docs",
          tool: "search",
          arguments: {},
        }),
      ),
    ).rejects.toThrow("MCP unavailable");
  });
});
