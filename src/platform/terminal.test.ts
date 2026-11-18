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
  resizeTerminal,
  startTerminal,
  writeTerminal,
} from "./terminal";

describe("terminal commands", () => {
  beforeEach(() => {
    invoke.mockReset();
    channels.length = 0;
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
});
