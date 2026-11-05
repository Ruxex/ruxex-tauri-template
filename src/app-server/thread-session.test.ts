import { beforeEach, describe, expect, it, vi } from "vitest";

const requestAppServerMethod = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ requestAppServerMethod }));

import {
  ensureThreadResumed,
  markThreadStarted,
  resetThreadSessionState,
} from "./thread-session";

describe("thread session coordinator", () => {
  beforeEach(() => {
    requestAppServerMethod.mockReset();
    resetThreadSessionState();
  });

  it("deduplicates concurrent resumes for the same thread", async () => {
    let resolveResume!: (value: unknown) => void;
    requestAppServerMethod.mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );

    const first = ensureThreadResumed("thread-1");
    const second = ensureThreadResumed("thread-1");

    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      excludeTurns: true,
    });

    resolveResume({ response: {} });
    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });

  it("allows a later resume after an earlier resume failed", async () => {
    requestAppServerMethod
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockResolvedValueOnce({ response: {} });

    await expect(ensureThreadResumed("thread-1")).rejects.toThrow(
      "socket closed",
    );
    await expect(ensureThreadResumed("thread-1")).resolves.toBeUndefined();

    expect(requestAppServerMethod).toHaveBeenCalledTimes(2);
  });

  it("skips resume once for a thread that was just started", async () => {
    markThreadStarted("thread-new");
    requestAppServerMethod.mockResolvedValue({ response: {} });

    await expect(ensureThreadResumed("thread-new")).resolves.toBeUndefined();
    await expect(ensureThreadResumed("thread-new")).resolves.toBeUndefined();

    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
    expect(requestAppServerMethod).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-new",
      excludeTurns: true,
    });
  });

  it("preserves the startup exemption for concurrent read consumers", async () => {
    markThreadStarted("thread-new");
    requestAppServerMethod.mockResolvedValue({ response: {} });

    await Promise.all([
      ensureThreadResumed("thread-new", { consumeStarted: false }),
      ensureThreadResumed("thread-new", { consumeStarted: false }),
      ensureThreadResumed("thread-new", { consumeStarted: false }),
    ]);
    await ensureThreadResumed("thread-new");

    expect(requestAppServerMethod).not.toHaveBeenCalled();
  });

  it("retries resume without paginated history when the server lacks it", async () => {
    requestAppServerMethod
      .mockRejectedValueOnce({
        code: -32601,
        message: "list_turns is not supported yet",
      })
      .mockResolvedValueOnce({ response: {} });

    await expect(ensureThreadResumed("thread-1")).resolves.toBeUndefined();

    expect(requestAppServerMethod).toHaveBeenNthCalledWith(1, "thread/resume", {
      threadId: "thread-1",
      excludeTurns: true,
    });
    expect(requestAppServerMethod).toHaveBeenNthCalledWith(2, "thread/resume", {
      threadId: "thread-1",
      excludeTurns: false,
    });
  });

  it("does not retry unrelated unsupported resume errors", async () => {
    const error = { code: -32601, message: "thread/resume is not supported" };
    requestAppServerMethod.mockRejectedValueOnce(error);

    await expect(ensureThreadResumed("thread-1")).rejects.toEqual(error);
    expect(requestAppServerMethod).toHaveBeenCalledTimes(1);
  });
});
