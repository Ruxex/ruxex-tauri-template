import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateProjectList,
  invalidateProjectQueries,
  invalidateThreadConversation,
  invalidateThreadList,
  invalidateThreadMetadata,
  invalidateThreadQueue,
  upsertThreadInListCaches,
} from "./query-invalidation";
import { appServerQueryKeys } from "./query-keys";

function createQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe("app-server query invalidation", () => {
  it("adds a newly created thread to matching cached lists", () => {
    const queryClient = new QueryClient();
    const activeParams = {
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    } as const;
    const projectOneParams = { projectId: "project-1", limit: 50 };
    const projectTwoParams = { projectId: "project-2", limit: 50 };
    const newThread = {
      id: "thread-new",
      projectId: "project-1",
    } as never;
    const response = (data: unknown[]) => ({
      data,
      nextCursor: null,
      backwardsCursor: null,
    });

    queryClient.setQueryData(
      appServerQueryKeys.threadList(activeParams),
      response([]),
    );
    queryClient.setQueryData(
      appServerQueryKeys.threadList(projectOneParams),
      response([]),
    );
    queryClient.setQueryData(
      appServerQueryKeys.threadList(projectTwoParams),
      response([]),
    );

    upsertThreadInListCaches(queryClient, newThread);

    expect(
      queryClient.getQueryData(appServerQueryKeys.threadList(activeParams)),
    ).toMatchObject({ data: [{ id: "thread-new" }] });
    expect(
      queryClient.getQueryData(appServerQueryKeys.threadList(projectOneParams)),
    ).toMatchObject({ data: [{ id: "thread-new" }] });
    expect(
      queryClient.getQueryData(appServerQueryKeys.threadList(projectTwoParams)),
    ).toMatchObject({ data: [] });
  });

  it("invalidates conversation queries without invalidating metadata", () => {
    const queryClient = createQueryClient();

    invalidateThreadConversation(queryClient, "thread-1");

    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["app-server", "thread", "thread-1", "conversation"],
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "metadata"],
    });
  });

  it("invalidates only thread metadata for metadata changes", () => {
    const queryClient = createQueryClient();

    invalidateThreadMetadata(queryClient, "thread-1");

    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "metadata"],
    });
  });

  it("invalidates only queue queries for queue changes", () => {
    const queryClient = createQueryClient();

    invalidateThreadQueue(queryClient, "thread-1");

    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1", "queue"],
    });
  });

  it("invalidates the thread list without touching a selected thread", () => {
    const queryClient = createQueryClient();

    invalidateThreadList(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "threads"],
    });
  });

  it("invalidates the project list without touching project details", () => {
    const queryClient = createQueryClient();

    invalidateProjectList(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "projects"],
    });
  });

  it("invalidates a project detail and the project list", () => {
    const queryClient = createQueryClient();

    invalidateProjectQueries(queryClient, "project-1");

    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["app-server", "project", "project-1"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["app-server", "projects"],
    });
  });
});
