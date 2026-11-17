// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../app/i18n";

const requestAppServerMethod = vi.hoisted(() => vi.fn());
const appServerStatus = vi.hoisted(() => vi.fn());
const desktopUiPolicy = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ requestAppServerMethod }));
vi.mock("../queries", () => ({
  useAppServerStatus: appServerStatus,
}));
vi.mock("../../platform/skill-policy", () => ({
  getDesktopUiPolicy: desktopUiPolicy,
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
    appServerStatus.mockReturnValue({ data: { appServerVersion: "test" } });
    desktopUiPolicy.mockReset();
    desktopUiPolicy.mockResolvedValue({
      hiddenSkills: [],
      defaultSkillRoots: [],
      userSkillRoots: [],
    });
  });

  it("keeps the vendored root while adding and removing user roots", async () => {
    const vendoredRoot = "/home/ada/.ruxex_desktop/vendored/skills";
    const userRoot = "/workspace/team-skills";
    desktopUiPolicy.mockResolvedValue({
      hiddenSkills: [],
      defaultSkillRoots: [vendoredRoot],
      userSkillRoots: ["/home/ada/.agents/skills"],
    });
    const hooks = await import("./useCapabilityQueries");
    const { result } = renderHook(() => hooks.useSetSkillsExtraRoots(), {
      wrapper: createWrapper(),
    });

    await act(async () =>
      result.current.mutateAsync({ extraRoots: [userRoot, vendoredRoot] }),
    );
    await act(async () => result.current.mutateAsync({ extraRoots: [] }));

    const addedRoots = requestAppServerMethod.mock.calls[0][1].extraRoots;
    expect(addedRoots).toEqual(
      expect.arrayContaining([vendoredRoot, userRoot]),
    );
    expect(addedRoots).toHaveLength(2);
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      2,
      "skills/extraRoots/set",
      { extraRoots: [vendoredRoot] },
    );
  });

  it.each([
    ["useSkillsList", "skills/list", { forceReload: true }],
    ["useHooksList", "hooks/list", {}],
    ["useMcpServerStatus", "mcpServerStatus/list", { limit: 10 }],
    ["usePluginList", "plugin/list", {}],
    [
      "usePluginRead",
      "plugin/read",
      { marketplacePath: "/tmp/community", pluginName: "example" },
    ],
    [
      "useMcpResource",
      "mcpServer/resource/read",
      { server: "docs", uri: "resource://guide" },
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

  it("does not request hooks before App Server is ready", async () => {
    appServerStatus.mockReturnValue({ data: undefined });
    const hooks = await import("./useCapabilityQueries");
    const { result } = renderHook(() => hooks.useHooksList(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });

  it.each([
    ["useConfig", {}],
    ["useMcpServerStatus", {}],
    ["usePluginList", {}],
    ["useCollaborationModes", undefined],
    ["useSkillsList", {}],
  ] as const)(
    "does not query capability data before App Server is ready for %s",
    async (hookName, params) => {
      appServerStatus.mockReturnValue({ data: undefined });
      const hooks = await import("./useCapabilityQueries");
      const hook = hooks[hookName] as (value?: never) => {
        fetchStatus: string;
      };
      const { result } = renderHook(() => hook(params as never), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(requestAppServerMethod).not.toHaveBeenCalled();
    },
  );

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
    [
      "useWriteSkillConfig",
      "skills/config/write",
      { path: "/workspace/.agents/skills/review", enabled: false },
    ],
    [
      "useSetSkillsExtraRoots",
      "skills/extraRoots/set",
      { extraRoots: ["/workspace/.agents/skills", "/tmp/shared-skills"] },
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

  it("does not read an MCP Resource before one is selected", async () => {
    const { useMcpResource } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useMcpResource(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
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

  it("does not invalidate plugins after a failed marketplace mutation", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    requestAppServerMethod.mockRejectedValueOnce(
      new Error("marketplace unavailable"),
    );
    const { useAddMarketplace } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useAddMarketplace(), {
      wrapper: createWrapper(client),
    });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          source: "https://example.com/marketplace.git",
        }),
      ),
    ).rejects.toThrow("marketplace unavailable");
    expect(invalidateQueries).not.toHaveBeenCalled();
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

  it("invalidates Skills after a successful Skill config write", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useWriteSkillConfig } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useWriteSkillConfig(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({
        path: "/workspace/.agents/skills/review",
        enabled: false,
      }),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "skills"],
    });
  });

  it.each([
    [
      "useMcpOauthLogin",
      { name: "docs", scopes: ["read"] },
      ["app-server", "mcp-servers"],
    ],
    [
      "useSetSkillsExtraRoots",
      { extraRoots: ["/workspace/.agents/skills"] },
      ["app-server", "skills"],
    ],
  ] as const)(
    "invalidates the related query after %s succeeds",
    async (hookName, params, queryKey) => {
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
      const { result } = renderHook(() => hook(), {
        wrapper: createWrapper(client),
      });

      await act(async () => result.current.mutateAsync(params as never));

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    },
  );

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

  it("updates cached MCP configuration errors when language changes without another request", async () => {
    requestAppServerMethod.mockReset().mockResolvedValue({
      response: {
        config: {},
        origins: {},
        layers: [
          {
            name: { type: "user" },
            version: "v1",
            config: {
              mcp_servers: { docs: { command: "node", args: "invalid" } },
            },
          },
        ],
      },
    });
    const { useGlobalMcpConfig } = await import("./useCapabilityQueries");
    const { result } = renderHook(() => useGlobalMcpConfig(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.servers[0]?.error).toBe(
      "args must be an array of strings",
    );
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    await waitFor(() =>
      expect(result.current.data?.servers[0]?.error).toBe(
        "args は文字列の配列で指定してください",
      ),
    );
    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
  });
});
