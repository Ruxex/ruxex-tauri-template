import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateProjectQueries,
  invalidateProjectList,
  invalidateThreadList,
  invalidateThreadQueries,
} from "./query-invalidation";

function createQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe("app-server query invalidation", () => {
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
