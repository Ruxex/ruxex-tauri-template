import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, channels } = vi.hoisted(() => ({
  invoke: vi.fn(),
  channels: [] as Array<{ onmessage: ((event: unknown) => void) | undefined }>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  Channel: class {
    onmessage: ((event: unknown) => void) | undefined;

    constructor() {
      channels.push(this);
    }
  },
}));

import {
  closeTerminal,
  closeManagedTerminalSession,
  detachTerminalSession,
  ensureTerminalSession,
  readTerminalSessionTimeout,
  resizeTerminal,
  resizeTerminalSession,
  setTerminalSessionIdleTimeout,
  subscribeTerminalSession,
  startTerminal,
  terminalSessionTimeoutMs,
  updateTerminalSessionTimeout,
  writeTerminal,
  writeTerminalSession,
} from "./terminal";

describe("terminal commands", () => {
  beforeEach(() => {
    invoke.mockReset();
    channels.length = 0;
    invoke.mockResolvedValue(undefined);
    vi.stubGlobal("window", globalThis);
  });

  it("forwards start options and sends channel events to the listener", async () => {
    invoke.mockResolvedValue("terminal-1");
    const onEvent = vi.fn();

    await expect(startTerminal("/workspace", 80, 24, onEvent)).resolves.toBe(
      "terminal-1",
    );

    expect(invoke).toHaveBeenCalledWith("terminal_start", {
      cwd: "/workspace",
      cols: 80,
      rows: 24,
      onEvent: channels[0],
    });
    const output = { type: "output", data: [65, 66] };
    channels[0]?.onmessage?.(output);
    expect(onEvent).toHaveBeenCalledWith(output);
  });

  it("forwards terminal write, resize, and close commands", async () => {
    invoke.mockResolvedValue(undefined);

    await writeTerminal("terminal-1", "hello");
    await resizeTerminal("terminal-1", 100, 30);
    await closeTerminal("terminal-1");

    expect(invoke.mock.calls).toEqual([
      ["terminal_write", { sessionId: "terminal-1", data: "hello" }],
      ["terminal_resize", { sessionId: "terminal-1", cols: 100, rows: 30 }],
      ["terminal_close", { sessionId: "terminal-1" }],
    ]);
  });

  it("reuses concurrent starts and replays output to new subscribers", async () => {
    invoke.mockResolvedValue("managed-1");
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribe = subscribeTerminalSession(
      "tab-managed-1",
      "/repo",
      firstListener,
    );

    const firstStart = ensureTerminalSession("tab-managed-1", "/repo", 80, 24);
    const secondStart = ensureTerminalSession("tab-managed-1", "/repo", 90, 30);
    expect(invoke).toHaveBeenCalledTimes(1);
    channels[0]?.onmessage?.({ type: "output", data: [65, 66] });
    await Promise.all([firstStart, secondStart]);

    const stopSecond = subscribeTerminalSession(
      "tab-managed-1",
      "/repo",
      secondListener,
    );
    expect(firstListener).toHaveBeenCalledWith({
      type: "output",
      data: [65, 66],
    });
    expect(secondListener).toHaveBeenCalledWith({
      type: "output",
      data: [65, 66],
    });

    await writeTerminalSession("tab-managed-1", "hello");
    await resizeTerminalSession("tab-managed-1", 100, 40);
    expect(invoke).toHaveBeenCalledWith("terminal_write", {
      sessionId: "managed-1",
      data: "hello",
    });
    expect(invoke).toHaveBeenCalledWith("terminal_resize", {
      sessionId: "managed-1",
      cols: 100,
      rows: 40,
    });

    unsubscribe();
    stopSecond();
    await closeManagedTerminalSession("tab-managed-1");
    expect(invoke).toHaveBeenCalledWith("terminal_close", {
      sessionId: "managed-1",
    });
  });

  it("broadcasts exit events and does not restart an exited session", async () => {
    invoke.mockResolvedValue("managed-exited");
    const listener = vi.fn();
    const unsubscribe = subscribeTerminalSession("tab-exited", null, listener);
    await ensureTerminalSession("tab-exited", null, 80, 24);

    channels[0]?.onmessage?.({ type: "exited" });
    expect(listener).toHaveBeenCalledWith({ type: "exited" });
    expect(subscribeTerminalSession("tab-exited", null, listener)).toBeTypeOf(
      "function",
    );
    await ensureTerminalSession("tab-exited", null, 80, 24);
    expect(
      invoke.mock.calls.filter(([command]) => command === "terminal_start"),
    ).toHaveLength(1);
    unsubscribe();
    await closeManagedTerminalSession("tab-exited");
  });

  it("resets to a retryable state after startup fails", async () => {
    invoke
      .mockRejectedValueOnce(new Error("spawn failed"))
      .mockResolvedValueOnce("retry");
    const first = ensureTerminalSession("tab-retry", null, 80, 24);
    await expect(first).rejects.toThrow("spawn failed");
    await ensureTerminalSession("tab-retry", null, 80, 24);
    expect(
      invoke.mock.calls.filter(([command]) => command === "terminal_start"),
    ).toHaveLength(2);
    await closeManagedTerminalSession("tab-retry");
  });

  it("does not forward writes or resizes for an unstarted session", async () => {
    await writeTerminalSession("missing-tab", "ignored");
    await resizeTerminalSession("missing-tab", 80, 24);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("maps supported timeout preferences and falls back for invalid stored values", async () => {
    expect(terminalSessionTimeoutMs("1h")).toBe(60 * 60 * 1000);
    expect(terminalSessionTimeoutMs("never")).toBeNull();
    invoke
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(null);
    await expect(readTerminalSessionTimeout()).resolves.toBe("6h");
    await expect(readTerminalSessionTimeout()).resolves.toBe("24h");
    await expect(updateTerminalSessionTimeout("never")).resolves.toBe("never");
    expect(invoke).toHaveBeenLastCalledWith("terminal_session_timeout_update", {
      hours: null,
    });
  });

  it("expires a detached terminal and emits the expired state", async () => {
    vi.useFakeTimers();
    invoke.mockResolvedValue("managed-expiry");
    const listener = vi.fn();
    const unsubscribe = subscribeTerminalSession("tab-expiry", null, listener);
    await ensureTerminalSession("tab-expiry", null, 80, 24);
    setTerminalSessionIdleTimeout(5);
    detachTerminalSession("tab-expiry");
    await vi.advanceTimersByTimeAsync(5);

    subscribeTerminalSession("tab-expiry", null, listener);
    expect(listener).toHaveBeenCalledWith({ type: "expired" });
    expect(invoke).toHaveBeenCalledWith("terminal_close", {
      sessionId: "managed-expiry",
    });
    unsubscribe();
    await closeManagedTerminalSession("tab-expiry");
    setTerminalSessionIdleTimeout(24 * 60 * 60 * 1000);
    vi.useRealTimers();
  });
});
