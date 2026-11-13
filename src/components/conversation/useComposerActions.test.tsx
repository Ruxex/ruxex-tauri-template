// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerActions } from "./useComposerActions";

const mutations = vi.hoisted(() => ({
  send: vi.fn(),
  archive: vi.fn(),
  compact: vi.fn(),
  steer: vi.fn(),
  queue: vi.fn(),
  interrupt: vi.fn(),
  goal: vi.fn(),
  settings: vi.fn(),
}));

vi.mock("../../app-server/hooks", () => ({
  useSendMessage: () => ({
    mutateAsync: mutations.send,
    isPending: false,
    error: null,
  }),
  useArchiveThread: () => ({
    mutateAsync: mutations.archive,
    isPending: false,
    error: null,
  }),
  useCompactThread: () => ({
    mutateAsync: mutations.compact,
    isPending: false,
    error: null,
  }),
  useSteerTurn: () => ({
    mutateAsync: mutations.steer,
    isPending: false,
    error: null,
  }),
  useQueueMessage: () => ({
    mutateAsync: mutations.queue,
    isPending: false,
    error: null,
  }),
  useInterruptTurn: () => ({
    mutateAsync: mutations.interrupt,
    isPending: false,
    error: null,
  }),
  useSetThreadGoal: () => ({
    mutateAsync: mutations.goal,
    isPending: false,
    error: null,
  }),
  useUpdateThreadSettings: () => ({
    mutateAsync: mutations.settings,
    isPending: false,
    error: null,
  }),
}));

describe("useComposerActions", () => {
  beforeEach(() => {
    Object.values(mutations).forEach((mutation) => {
      mutation.mockReset();
    });
  });

  it("dispatches a send plan to the send mutation", async () => {
    const params = {
      threadId: "thread-1",
      input: [{ type: "text" as const, text: "hello", text_elements: [] }],
      model: "model-a",
      effort: "high",
    };
    const { result } = renderHook(() => useComposerActions("thread-1"));

    await result.current.submit({ kind: "send", params });

    expect(mutations.send).toHaveBeenCalledWith(params);
  });

  it("adds the active status when dispatching a goal plan", async () => {
    const { result } = renderHook(() => useComposerActions("thread-1"));

    await result.current.submit({
      kind: "goal",
      threadId: "thread-1",
      objective: "ship this",
    });

    expect(mutations.goal).toHaveBeenCalledWith({
      threadId: "thread-1",
      objective: "ship this",
      status: "active",
    });
  });
});
