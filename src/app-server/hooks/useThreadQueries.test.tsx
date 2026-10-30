// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";
import { appServerQueryKeys } from "../query-keys";

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("thread query hooks", () => {
  beforeEach(() => {
    appServerStatus.data = { appServerVersion: "test" };
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockImplementation(async (method: string) => {
      if (method === "thread/read") {
        return { response: { thread: { id: "thread-1" } } };
      }
      if (method === "thread/turns/list") {
        return { response: { data: [], nextCursor: null } };
      }
      if (method === "thread/items/list") {
        return { response: { data: [], nextCursor: null } };
      }
      return {
        response: { data: [], nextCursor: null, backwardsCursor: null },
      };
    });
  });

  it("passes list parameters to thread/list", async () => {
    const { useThreadList } = await import("./useThreadQueries");
    const params: v2.ThreadListParams = {
      projectId: "project-1",
      archived: false,
      limit: 25,
      sortKey: "recency_at",
      sortDirection: "desc",
    };
    const { result } = renderHook(() => useThreadList(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/list", params);
  });

  it("does not search when the search term is blank", async () => {
    const { useThreadSearch } = await import("./useThreadQueries");
    renderHook(() => useThreadSearch("   "), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });

  it("builds a search request with stable result ordering", async () => {
    const { useThreadSearch } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadSearch("compiler"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/search", {
      searchTerm: "compiler",
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
  });

  it("combines thread, turn, and item responses for a conversation", async () => {
    const { useThreadConversation } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadConversation("thread-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      thread: { id: "thread-1" },
      turns: { data: [], nextCursor: null },
      items: { data: [], nextCursor: null },
    });
    expect(requestAppServerMethod.mock.calls.map(([method]) => method)).toEqual(
      [
        "thread/resume",
        "thread/read",
        "thread/turns/list",
        "thread/items/list",
      ],
    );
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      excludeTurns: true,
    });
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
    });
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/turns/list", {
      threadId: "thread-1",
    });
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/items/list", {
      threadId: "thread-1",
    });
  });

  it("refreshes conversation metadata independently from turns and items", async () => {
    let threadReadCount = 0;
    requestAppServerMethod.mockImplementation(async (method: string) => {
      if (method === "thread/read") {
        threadReadCount += 1;
        return {
          response: {
            thread: { id: "thread-1", model: `model-${threadReadCount}` },
          },
        };
      }
      if (method === "thread/turns/list") {
        return { response: { data: [], nextCursor: null } };
      }
      if (method === "thread/items/list") {
        return { response: { data: [], nextCursor: null } };
      }
      return { response: {} };
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const testWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { useThreadConversation } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadConversation("thread-1"), {
      wrapper: testWrapper,
    });

    await waitFor(() => {
      expect(result.current.data?.thread.model).toBe("model-1");
    });
    const conversationRequestCount = requestAppServerMethod.mock.calls.filter(
      ([method]) =>
        method === "thread/turns/list" || method === "thread/items/list",
    ).length;

    await queryClient.invalidateQueries({
      queryKey: appServerQueryKeys.threadMetadata("thread-1"),
    });

    await waitFor(() => {
      expect(result.current.data?.thread.model).toBe("model-2");
    });
    expect(
      requestAppServerMethod.mock.calls.filter(
        ([method]) =>
          method === "thread/turns/list" || method === "thread/items/list",
      ),
    ).toHaveLength(conversationRequestCount);
  });

  it("resynchronizes all conversation queries on demand", async () => {
    const { useThreadConversation } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadConversation("thread-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const initialCounts = new Map(
      ["thread/read", "thread/turns/list", "thread/items/list"].map(
        (method) => [
          method,
          requestAppServerMethod.mock.calls.filter(
            ([calledMethod]) => calledMethod === method,
          ).length,
        ],
      ),
    );

    await result.current.resync();

    for (const [method, count] of initialCounts) {
      expect(
        requestAppServerMethod.mock.calls.filter(
          ([calledMethod]) => calledMethod === method,
        ),
      ).toHaveLength(count + 1);
    }
  });

  it("passes thread-specific parameters to goal, attachment, and queue queries", async () => {
    const { useThreadAttachments, useThreadGoal, useThreadQueue } =
      await import("./useThreadQueries");
    const { result } = renderHook(
      () => ({
        goal: useThreadGoal("thread-1"),
        attachments: useThreadAttachments("thread-1", { limit: 10 }),
        queue: useThreadQueue("thread-1", { limit: 5 }),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.goal.isSuccess).toBe(true);
      expect(result.current.attachments.isSuccess).toBe(true);
      expect(result.current.queue.isSuccess).toBe(true);
    });

    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/goal/get", {
      threadId: "thread-1",
    });
    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "thread/attachment/list",
      {
        threadId: "thread-1",
        limit: 10,
      },
    );
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/queue/list", {
      threadId: "thread-1",
      limit: 5,
    });
  });

  it("uses the archived list contract and its stable default filters", async () => {
    const { archivedThreadListParams, useArchivedThreadList } = await import(
      "./useThreadQueries"
    );
    const { result } = renderHook(() => useArchivedThreadList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(archivedThreadListParams()).toEqual({
      archived: true,
      limit: 50,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
    expect(requestAppServerMethod).toHaveBeenCalledWith(
      "thread/list",
      archivedThreadListParams(),
    );
  });

  it("does not request an empty thread id", async () => {
    const { useThread, useThreadConversation } = await import(
      "./useThreadQueries"
    );
    renderHook(
      () => ({
        thread: useThread(""),
        conversation: useThreadConversation(""),
      }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });

  it("surfaces a conversation subrequest failure", async () => {
    requestAppServerMethod.mockRejectedValueOnce(
      new Error("thread read failed"),
    );
    const { useThreadConversation } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadConversation("thread-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain("thread read failed");
  });

  it("disables server queries while the app-server is unavailable", async () => {
    appServerStatus.data = undefined;
    const { useThreadList } = await import("./useThreadQueries");
    const { result } = renderHook(() => useThreadList(), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });
});
