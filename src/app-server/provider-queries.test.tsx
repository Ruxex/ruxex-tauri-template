// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestAppServerMethod = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ requestAppServerMethod }));
vi.mock("./runtime-queries", () => ({
  useAppServerStatus: () => ({ data: { appServerVersion: "test" } }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("provider query hooks", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockImplementation(async (method: string) => ({
      response: { method },
    }));
  });

  it.each([
    ["useModelList", "model/list", {}],
    ["useModelProvider", "modelProvider/read", {}],
    ["useModelProviderCapabilities", "modelProvider/capabilities/read", {}],
    ["usePermissionProfiles", "permissionProfile/list", {}],
  ] as const)("maps %s to %s", async (hookName, method, params) => {
    const hooks = await import("./provider-queries");
    const hook = hooks[hookName] as () => { isSuccess: boolean };
    const { result } = renderHook(() => hook(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith(method, params);
  });
});
