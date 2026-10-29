// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";

const requestAppServerMethod = vi.hoisted(() => vi.fn());
const appServerStatus = vi.hoisted(() => ({
  data: { appServerVersion: "test" } as
    | { appServerVersion: string }
    | undefined,
}));

vi.mock("../api", () => ({ requestAppServerMethod }));
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

describe("project hooks", () => {
  beforeEach(() => {
    appServerStatus.data = { appServerVersion: "test" };
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockResolvedValue({ response: { data: [] } });
  });

  it("passes project list filters to project/list", async () => {
    const { useProjectList } = await import("./useProjects");
    const params: v2.ProjectListParams = { limit: 20, cursor: "cursor-1" };
    const { result } = renderHook(() => useProjectList(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith("project/list", params);
  });

  it("passes the selected project id to project/read", async () => {
    const { useProject } = await import("./useProjects");
    const { result } = renderHook(() => useProject("project-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith("project/read", {
      projectId: "project-1",
    });
  });

  it("creates a project and returns the server response", async () => {
    const response = { project: { id: "project-1" } };
    requestAppServerMethod.mockResolvedValueOnce({ response });
    const { useCreateProject } = await import("./useProjects");
    const params: v2.ProjectCreateParams = {
      name: "Ruxex",
      roots: [],
      idempotencyKey: "test-project-1",
    };
    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => result.current.mutateAsync(params)),
    ).resolves.toEqual(response);
    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "project/create",
      params,
    );
  });

  it("invalidates the project collection after creation", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useCreateProject } = await import("./useProjects");
    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({
        name: "Ruxex",
        roots: [],
        idempotencyKey: "project-2",
      }),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "projects"],
    });
  });

  it("updates a project and invalidates its detail and collection queries", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useUpdateProject } = await import("./useProjects");
    const params: v2.ProjectUpdateParams = {
      projectId: "project-1",
      name: "Updated project",
      roots: [{ path: "/workspace/updated" }],
    };
    const { result } = renderHook(() => useUpdateProject(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.mutateAsync(params));

    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "project/update",
      params,
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "project", "project-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "projects"],
    });
  });

  it("deletes a project and invalidates the project collection", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { useDeleteProject } = await import("./useProjects");
    const params: v2.ProjectDeleteParams = { projectId: "project-1" };
    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.mutateAsync(params));

    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "project/delete",
      params,
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "projects"],
    });
  });

  it("surfaces project read failures", async () => {
    requestAppServerMethod.mockRejectedValueOnce(
      new Error("project unavailable"),
    );
    const { useProject } = await import("./useProjects");
    const { result } = renderHook(() => useProject("project-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain("project unavailable");
  });

  it("does not request projects before app-server availability", async () => {
    appServerStatus.data = undefined;
    const { useProjectList } = await import("./useProjects");
    const { result } = renderHook(() => useProjectList(), {
      wrapper: createWrapper(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });
});
