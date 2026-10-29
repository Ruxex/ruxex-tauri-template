// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";

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

describe("turn mutation hooks", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
    requestAppServerMethod.mockResolvedValue({ response: { ok: true } });
  });

  it("starts a turn with the caller's input", async () => {
    const { useSendMessage } = await import("./useTurns");
    const params = {
      threadId: "thread-1",
      input: [{ type: "text", text: "hello", text_elements: [] }],
    } as v2.TurnStartParams;
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.mutateAsync(params));

    expect(requestAppServerMethod).toHaveBeenNthCalledWith(1, "thread/resume", {
      threadId: "thread-1",
      excludeTurns: true,
    });
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(2, "turn/start", params);
  });

  it("interrupts and steers the selected active turn", async () => {
    const { useInterruptTurn, useSteerTurn } = await import("./useTurns");
    const input = [
      { type: "text", text: "change direction", text_elements: [] },
    ] as v2.UserInput[];
    const { result } = renderHook(
      () => ({ interrupt: useInterruptTurn(), steer: useSteerTurn() }),
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.interrupt.mutateAsync({
        threadId: "thread-1",
        turnId: "turn-1",
      });
      await result.current.steer.mutateAsync({
        threadId: "thread-1",
        expectedTurnId: "turn-1",
        input,
      });
    });

    expect(requestAppServerMethod).toHaveBeenNthCalledWith(
      1,
      "turn/interrupt",
      {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    );
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(2, "turn/steer", {
      threadId: "thread-1",
      expectedTurnId: "turn-1",
      input,
    });
  });

  it("queues a message with a unique client user message id", async () => {
    const { useQueueMessage } = await import("./useTurns");
    const params = {
      threadId: "thread-1",
      input: [{ type: "text", text: "later", text_elements: [] }],
    } as Omit<v2.ThreadQueueAddParams, "clientUserMessageId">;
    const { result } = renderHook(() => useQueueMessage(), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.mutateAsync(params));

    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/queue/add", {
      ...params,
      clientUserMessageId: expect.stringMatching(/^desktop-\d+-[a-z0-9]+$/),
    });
  });

  it("invalidates both the selected thread and thread list after a successful turn", async () => {
    const { useSendMessage } = await import("./useTurns");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(client),
    });

    await act(async () =>
      result.current.mutateAsync({
        threadId: "thread-1",
        input: [{ type: "text", text: "hello", text_elements: [] }],
      } as v2.TurnStartParams),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "thread", "thread-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["app-server", "threads"],
    });
  });

  it("surfaces an app-server failure without invalidating cached thread data", async () => {
    requestAppServerMethod.mockRejectedValueOnce(new Error("socket closed"));
    const { useSendMessage } = await import("./useTurns");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(client),
    });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          threadId: "thread-1",
          input: [{ type: "text", text: "hello", text_elements: [] }],
        } as v2.TurnStartParams),
      ),
    ).rejects.toThrow("socket closed");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
