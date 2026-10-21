// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerStatus } from "../api";
import { appServerQueryKeys } from "../query-keys";

const appServerConnectionStatus = vi.hoisted(() => vi.fn());
const connectAppServer = vi.hoisted(() => vi.fn());
const disconnectAppServer = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  appServerConnectionStatus,
  connectAppServer,
  disconnectAppServer,
}));
vi.mock("../runtime", () => ({ isDesktopRuntime: true }));

function createWrapper(client: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useAppServerConnection", () => {
  const localStatus: AppServerStatus = {
    socketPath: "/tmp/ruxex.sock",
    appServerVersion: "local",
    endpointKind: "local",
  };
  const remoteStatus: AppServerStatus = {
    socketPath: "wss://example.test/rpc",
    appServerVersion: "remote",
    endpointKind: "websocket",
  };

  beforeEach(() => {
    appServerConnectionStatus.mockReset().mockResolvedValue(localStatus);
    connectAppServer.mockReset().mockResolvedValue(remoteStatus);
    disconnectAppServer.mockReset().mockResolvedValue(undefined);
  });

  it("loads the active connection and updates it after a remote connect", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useConnection(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.status.refetch());
    expect(appServerConnectionStatus).toHaveBeenCalled();
    expect(client.getQueryData(appServerQueryKeys.connection)).toEqual(localStatus);

    await act(async () =>
      result.current.connect.mutateAsync({
        kind: "websocket",
        url: "wss://example.test/rpc",
        authToken: "memory-only-token",
      }),
    );

    expect(connectAppServer).toHaveBeenCalledWith({
      kind: "websocket",
      url: "wss://example.test/rpc",
      authToken: "memory-only-token",
    });
    expect(client.getQueryData(appServerQueryKeys.connection)).toEqual(remoteStatus);
    expect(client.getQueryData(appServerQueryKeys.status)).toEqual(remoteStatus);
  });

  it("clears the cached status after disconnecting", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useConnection(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.status.refetch());
    await act(async () => result.current.disconnect.mutateAsync());

    expect(disconnectAppServer).toHaveBeenCalledOnce();
    expect(client.getQueryData(appServerQueryKeys.connection)).toBeNull();
    expect(client.getQueryData(appServerQueryKeys.status)).toBeNull();
  });
});

async function useConnectionModule() {
  return import("./useAppServerConnection");
}

let useConnection: (typeof import("./useAppServerConnection"))["useAppServerConnection"];

beforeEach(async () => {
  ({ useAppServerConnection: useConnection } = await useConnectionModule());
});
