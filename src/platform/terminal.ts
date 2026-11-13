import { Channel, invoke } from "@tauri-apps/api/core";

export type TerminalEvent =
  | { type: "output"; data: number[] }
  | { type: "exited" };

export function startTerminal(
  cwd: string | null,
  cols: number,
  rows: number,
  onEvent: (event: TerminalEvent) => void,
): Promise<string> {
  const channel = new Channel<TerminalEvent>();
  channel.onmessage = onEvent;
  return invoke<string>("terminal_start", {
    cwd,
    cols,
    rows,
    onEvent: channel,
  });
}

export function writeTerminal(sessionId: string, data: string): Promise<void> {
  return invoke("terminal_write", { sessionId, data });
}

export function resizeTerminal(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("terminal_resize", { sessionId, cols, rows });
}

export function closeTerminal(sessionId: string): Promise<void> {
  return invoke("terminal_close", { sessionId });
}
