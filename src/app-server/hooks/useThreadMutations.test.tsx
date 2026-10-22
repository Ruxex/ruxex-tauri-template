// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestAppServerMethod = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ requestAppServerMethod }));

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

describe("thread mutation hooks", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockResolvedValue({ response: { ok: true } });
  });

  it.each([
    ["thread/start", "useCreateThread", {}],
    ["thread/archive", "useArchiveThread", { threadId: "thread-1" }],
    ["thread/unarchive", "useUnarchiveThread", { threadId: "thread-1" }],
    [
      "thread/name/set",
      "useRenameThread",
      { threadId: "thread-1", name: "Renamed" },
    ],
    ["thread/resume", "useResumeThread", { threadId: "thread-1" }],
    [
      "thread/fork",
      "useForkThread",
      { threadId: "thread-1", excludeTurns: true },
    ],
    [
      "thread/goal/set",
      "useSetThreadGoal",
      { threadId: "thread-1", objective: "Ship safely" },
    ],
    ["thread/goal/clear", "useClearThreadGoal", { threadId: "thread-1" }],
    [
      "thread/attachment/add",
      "useAddThreadAttachment",
      {
        threadId: "thread-1",
        attachmentType: "image",
        identityKey: "image-1",
        payload: { dataUrl: "data:image/png;base64,AA==" },
      },
    ],
    [
      "thread/attachment/remove",
      "useRemoveThreadAttachment",
      {
        threadId: "thread-1",
        attachmentType: "image",
        identityKey: "image-1",
      },
    ],
    [
      "thread/settings/update",
      "useUpdateThreadSettings",
      { threadId: "thread-1", model: "ruxex" },
    ],
    [
      "thread/queue/update",
      "useUpdateThreadQueue",
      {
        threadId: "thread-1",
        queuedSubmissionId: "queued-1",
        input: [],
      },
    ],
    [
      "thread/queue/delete",
      "useDeleteThreadQueueItem",
      {
        threadId: "thread-1",
        queuedSubmissionId: "queued-1",
      },
    ],
    [
      "thread/queue/reorder",
      "useReorderThreadQueue",
      {
        threadId: "thread-1",
        queuedSubmissionIds: ["queued-1"],
      },
    ],
    [
      "thread/queue/start",
      "useStartThreadQueue",
      { threadId: "thread-1", queuedSubmissionId: "queued-1" },
    ],
  ] as const)(
    "maps %s to the App Server request",
    async (method, hookName, params) => {
      const hooks = await import("./useThreadMutations");
      const hook = hooks[hookName] as () => {
        mutateAsync: (value: never) => Promise<unknown>;
      };
      const { result } = renderHook(() => hook(), { wrapper: createWrapper() });

      await act(async () => result.current.mutateAsync(params as never));

      expect(requestAppServerMethod).toHaveBeenCalledWith(method, params);
    },
  );

  it("uses the server response as the mutation result", async () => {
    const response = { thread: { id: "thread-1" } };
    requestAppServerMethod.mockResolvedValueOnce({ response });
    const { useCreateThread } = await import("./useThreadMutations");
    const { result } = renderHook(() => useCreateThread(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => result.current.mutateAsync({})),
    ).resolves.toEqual(response);
  });

  it("invalidates the thread list after archiving", async () => {
    const { useArchiveThread } = await import("./useThreadMutations");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useArchiveThread(), {
      wrapper: createWrapper(client),
    });

    await act(async () => result.current.mutateAsync({ threadId: "thread-1" }));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "threads"],
    });
  });

  it("invalidates one thread prefix and one thread-list prefix", async () => {
    const { useSetThreadGoal } = await import("./useThreadMutations");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSetThreadGoal(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({
        threadId: "thread-1",
        objective: "Ship safely",
      }),
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["app-server", "thread", "thread-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["app-server", "threads"],
    });
  });

  it("does not invalidate after a failed rename", async () => {
    requestAppServerMethod.mockRejectedValueOnce(
      new Error("thread unavailable"),
    );
    const { useRenameThread } = await import("./useThreadMutations");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRenameThread(), {
      wrapper: createWrapper(client),
    });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          threadId: "thread-1",
          name: "Renamed",
        }),
      ),
    ).rejects.toThrow("thread unavailable");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
