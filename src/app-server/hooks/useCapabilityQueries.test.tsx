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
    ["useStartReview", "review/start", { threadId: "thread-1", target: {} }],
    [
      "useUpdateTurnSettings",
      "turn/settings/update",
      { threadId: "thread-1", turnId: "turn-1", effort: "high" },
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
