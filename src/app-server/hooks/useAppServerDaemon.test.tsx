// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerStatus } from "../api";
import type {
  AppServerDaemonAction,
  AppServerDaemonOutput,
} from "../daemon-api";
import { appServerQueryKeys } from "../query-keys";

const controlAppServerDaemon = vi.hoisted(() => vi.fn());
const ensureAppServer = vi.hoisted(() => vi.fn());

vi.mock("../daemon-api", () => ({ controlAppServerDaemon }));
vi.mock("../api", () => ({ ensureAppServer }));
vi.mock("../runtime", () => ({ isNativeDesktopRuntime: true }));

function createWrapper(client: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const runningDaemon: AppServerDaemonOutput = {
  status: "running",
  backend: "pid",
  pid: 42,
  managedRuxexPath: "/tmp/ruxex-desktop",
  managedRuxexVersion: "0.4.9",
  socketPath: "/tmp/ruxex.sock",
  cliVersion: "0.4.9",
  appServerVersion: "0.4.9",
};

const startedDaemon: AppServerDaemonOutput = {
  ...runningDaemon,
  status: "started",
  pid: 43,
};

const stoppedDaemon: AppServerDaemonOutput = {
  ...runningDaemon,
  status: "stopped",
  backend: undefined,
  pid: undefined,
  appServerVersion: undefined,
};

const connectedStatus: AppServerStatus = {
  socketPath: "/tmp/ruxex.sock",
  appServerVersion: "0.4.9",
  endpointKind: "local",
};

describe("useAppServerDaemon", () => {
  let useAppServerDaemon: typeof import("./useAppServerDaemon")["useAppServerDaemon"];

  beforeEach(async () => {
    controlAppServerDaemon.mockReset().mockResolvedValue(runningDaemon);
    ensureAppServer.mockReset().mockResolvedValue(connectedStatus);
    ({ useAppServerDaemon } = await import("./useAppServerDaemon"));
  });

  it("loads daemon status through the version action", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useAppServerDaemon(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.status.isSuccess).toBe(true);
      expect(controlAppServerDaemon).toHaveBeenCalledWith("version");
      expect(result.current.status.data).toEqual(runningDaemon);
    });
  });

  it("reconnects after start and clears app-server caches after stop", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    controlAppServerDaemon
      .mockResolvedValueOnce(startedDaemon)
      .mockResolvedValueOnce(stoppedDaemon);
    client.setQueryData(appServerQueryKeys.status, connectedStatus);
    client.setQueryData(appServerQueryKeys.connection, connectedStatus);

    const { result } = renderHook(() => useAppServerDaemon(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.control.mutateAsync("start" as AppServerDaemonAction),
    );
    expect(controlAppServerDaemon).toHaveBeenCalledWith("start");
    expect(ensureAppServer).toHaveBeenCalledOnce();
    expect(client.getQueryData(appServerQueryKeys.status)).toEqual(
      connectedStatus,
    );
    expect(client.getQueryData(appServerQueryKeys.connection)).toEqual(
      connectedStatus,
    );

    await act(async () =>
      result.current.control.mutateAsync("stop" as AppServerDaemonAction),
    );
    expect(controlAppServerDaemon).toHaveBeenCalledWith("stop");
    expect(client.getQueryData(appServerQueryKeys.status)).toBeNull();
    expect(client.getQueryData(appServerQueryKeys.connection)).toBeNull();
  });

  it("exposes a version query error when the daemon is unavailable", async () => {
    const error = new Error("daemon unavailable");
    controlAppServerDaemon.mockRejectedValue(error);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useAppServerDaemon(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.status.isError).toBe(true);
      expect(result.current.status.error).toBe(error);
    });
  });

  it("clears local connection caches when a lifecycle action fails", async () => {
    const error = new Error("restart failed");
    controlAppServerDaemon.mockRejectedValue(error);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(appServerQueryKeys.connection, connectedStatus);
    client.setQueryData(appServerQueryKeys.status, connectedStatus);

    const { result } = renderHook(() => useAppServerDaemon(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.control.mutateAsync("restart")).rejects.toBe(
        error,
      );
    });
    expect(client.getQueryData(appServerQueryKeys.connection)).toBeNull();
    expect(client.getQueryData(appServerQueryKeys.status)).toBeNull();
  });

  it("preserves remote connection caches when stopping the local daemon", async () => {
    const remoteStatus: AppServerStatus = {
      ...connectedStatus,
      socketPath: "wss://example.test/rpc",
      endpointKind: "websocket",
    };
    controlAppServerDaemon.mockResolvedValue(stoppedDaemon);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(appServerQueryKeys.connection, remoteStatus);
    client.setQueryData(appServerQueryKeys.status, remoteStatus);

    const { result } = renderHook(() => useAppServerDaemon(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.control.mutateAsync("stop" as AppServerDaemonAction),
    );
    expect(client.getQueryData(appServerQueryKeys.connection)).toEqual(
      remoteStatus,
    );
    expect(client.getQueryData(appServerQueryKeys.status)).toEqual(remoteStatus);
  });
});
