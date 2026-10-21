// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureAppServer = vi.hoisted(() => vi.fn());
const requestAppServerMethod = vi.hoisted(() => vi.fn());
const appServerStatus = vi.hoisted(() => ({
  data: { appServerVersion: "test" } as
    | { appServerVersion: string }
    | undefined,
}));

vi.mock("../api", () => ({ ensureAppServer, requestAppServerMethod }));
vi.mock("../queries", () => ({
  useAppServerStatus: () => appServerStatus,
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

describe("account hooks", () => {
  beforeEach(() => {
    appServerStatus.data = { appServerVersion: "test" };
    ensureAppServer.mockReset();
    requestAppServerMethod.mockReset();
    ensureAppServer.mockResolvedValue({ socketPath: "/tmp/test.sock" });
    requestAppServerMethod.mockResolvedValue({ response: { ok: true } });
  });

  it("ensures the app-server before starting API-key login", async () => {
    const { useLogin } = await import("./useAccount");
    const params = { type: "apiKey", apiKey: "secret" } as const;
    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.mutateAsync(params));

    expect(ensureAppServer).toHaveBeenCalledTimes(1);
    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "account/login/start",
      params,
    );
    expect(ensureAppServer.mock.invocationCallOrder[0]).toBeLessThan(
      requestAppServerMethod.mock.invocationCallOrder[0],
    );
  });

  it("passes refresh-token selection to account reads", async () => {
    const { useAccount } = await import("./useAccount");
    const { result } = renderHook(() => useAccount({ refreshToken: true }), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.refetch());

    expect(requestAppServerMethod).toHaveBeenCalledWith("account/read", {
      refreshToken: true,
    });
  });

  it("maps cancel and logout to their dedicated methods", async () => {
    const { useCancelLogin, useLogout } = await import("./useAccount");
    const { result } = renderHook(
      () => ({ cancel: useCancelLogin(), logout: useLogout() }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.cancel.mutateAsync({ loginId: "login-1" });
      await result.current.logout.mutateAsync();
    });

    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      1,
      "account/login/cancel",
      { loginId: "login-1" },
    );
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      2,
      "account/logout",
      undefined,
    );
  });

  it("invalidates account data after a successful login and logout", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useLogin, useLogout } = await import("./useAccount");
    const { result } = renderHook(
      () => ({ login: useLogin(), logout: useLogout() }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      await result.current.login.mutateAsync({
        type: "apiKey",
        apiKey: "secret",
      });
      await result.current.logout.mutateAsync();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "account"],
    });
  });

  it("does not call account/login when app-server initialization fails", async () => {
    ensureAppServer.mockRejectedValueOnce(new Error("daemon unavailable"));
    const { useLogin } = await import("./useAccount");
    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () =>
        result.current.mutateAsync({ type: "apiKey", apiKey: "secret" }),
      ),
    ).rejects.toThrow("daemon unavailable");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });

  it("keeps account queries idle while the app-server is unavailable", async () => {
    appServerStatus.data = undefined;
    const { useAccount } = await import("./useAccount");
    const { result } = renderHook(() => useAccount(), {
      wrapper: createWrapper(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });
});
