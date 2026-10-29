import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateProjectList,
  invalidateProjectQueries,
  invalidateThreadConversation,
  invalidateThreadList,
  invalidateThreadMetadata,
  invalidateThreadQueries,
  invalidateThreadQueue,
} from "./query-invalidation";

function createQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe("app-server query invalidation", () => {
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

  it("invalidates every thread query and the thread list", () => {
    const queryClient = createQueryClient();

    invalidateThreadQueries(queryClient, "thread-1");

    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["app-server", "thread", "thread-1"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["app-server", "threads"],
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
