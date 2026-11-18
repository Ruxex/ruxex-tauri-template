import { Channel, invoke } from "@tauri-apps/api/core";

export type TerminalEvent = { type: "output"; data: number[] } | { type: "exited" } | { type: "expired" };

type TerminalEventListener = (event: TerminalEvent) => void;

type ManagedTerminal = {
  cwd: string | null;
  sessionId: string | null;
  starting: Promise<void> | null;
  status: "new" | "running" | "exited" | "expired";
  output: Uint8Array[];
  outputBytes: number;
  listeners: Set<TerminalEventListener>;
  hiddenSince: number | null;
  idleTimer: number | null;
  generation: number;
};

const MAX_RETAINED_OUTPUT_BYTES = 256 * 1024;
const managedTerminals = new Map<string, ManagedTerminal>();
let idleTimeoutMs: number | null = 24 * 60 * 60 * 1000;

export const TERMINAL_SESSION_TIMEOUTS = ["1h", "6h", "24h", "72h", "never"] as const;
export type TerminalSessionTimeout = (typeof TERMINAL_SESSION_TIMEOUTS)[number];
export const DEFAULT_TERMINAL_SESSION_TIMEOUT: TerminalSessionTimeout = "24h";

function timeoutFromHours(hours: number | null): TerminalSessionTimeout {
  if (hours === null) return "never";
  return `${hours}h` as TerminalSessionTimeout;
}

function hoursFromTimeout(timeout: TerminalSessionTimeout): number | null {
  return timeout === "never" ? null : Number.parseInt(timeout, 10);
}

export function terminalSessionTimeoutMs(timeout: TerminalSessionTimeout): number | null {
  const hours = hoursFromTimeout(timeout);
  return hours === null ? null : hours * 60 * 60 * 1000;
}

export async function readTerminalSessionTimeout(): Promise<TerminalSessionTimeout> {
  const hours = await invoke<number | null>("terminal_session_timeout_read");
  if (hours === null || [1, 6, 24, 72].includes(hours)) {
    return timeoutFromHours(hours);
  }
  return DEFAULT_TERMINAL_SESSION_TIMEOUT;
}

export async function updateTerminalSessionTimeout(timeout: TerminalSessionTimeout): Promise<TerminalSessionTimeout> {
  const hours = await invoke<number | null>("terminal_session_timeout_update", {
    hours: hoursFromTimeout(timeout),
  });
  return timeoutFromHours(hours);
}

function managedTerminal(tabId: string, cwd: string | null): ManagedTerminal {
  const existing = managedTerminals.get(tabId);
  if (existing) {
    existing.cwd = cwd;
    return existing;
  }
  const terminal: ManagedTerminal = {
    cwd,
    sessionId: null,
    starting: null,
    status: "new",
    output: [],
    outputBytes: 0,
    listeners: new Set(),
    hiddenSince: null,
    idleTimer: null,
    generation: 0,
  };
  managedTerminals.set(tabId, terminal);
  return terminal;
}

function appendTerminalOutput(terminal: ManagedTerminal, data: number[]) {
  const chunk = Uint8Array.from(data);
  terminal.output.push(chunk);
  terminal.outputBytes += chunk.byteLength;
  while (terminal.outputBytes > MAX_RETAINED_OUTPUT_BYTES && terminal.output.length > 0) {
    const removed = terminal.output.shift();
    if (!removed) break;
    terminal.outputBytes -= removed.byteLength;
  }
}

function clearIdleTimer(terminal: ManagedTerminal) {
  if (terminal.idleTimer !== null) {
    window.clearTimeout(terminal.idleTimer);
    terminal.idleTimer = null;
  }
}

function scheduleTerminalExpiry(tabId: string, terminal: ManagedTerminal) {
  clearIdleTimer(terminal);
  if (terminal.hiddenSince === null || idleTimeoutMs === null) return;
  const remaining = idleTimeoutMs - (Date.now() - terminal.hiddenSince);
  if (remaining <= 0) {
    void expireManagedTerminal(tabId, terminal);
    return;
  }
  terminal.idleTimer = window.setTimeout(() => {
    terminal.idleTimer = null;
    void expireManagedTerminal(tabId, terminal);
  }, remaining);
}

async function expireManagedTerminal(tabId: string, terminal: ManagedTerminal) {
  if (managedTerminals.get(tabId) !== terminal || terminal.hiddenSince === null) {
    return;
  }
  const sessionId = terminal.sessionId;
  terminal.sessionId = null;
  terminal.starting = null;
  terminal.hiddenSince = null;
  terminal.generation += 1;
  terminal.status = "expired";
  terminal.output = [];
  terminal.outputBytes = 0;
  if (sessionId) await closeTerminal(sessionId).catch(() => undefined);
}

export function setTerminalSessionIdleTimeout(timeoutMs: number | null) {
  idleTimeoutMs = timeoutMs;
  for (const [tabId, terminal] of managedTerminals) {
    scheduleTerminalExpiry(tabId, terminal);
  }
}

export function subscribeTerminalSession(tabId: string, cwd: string | null, listener: TerminalEventListener) {
  const terminal = managedTerminal(tabId, cwd);
  clearIdleTimer(terminal);
  const hiddenSince = terminal.hiddenSince;
  const expiredWhileSuspended =
    hiddenSince !== null && idleTimeoutMs !== null && Date.now() - hiddenSince >= idleTimeoutMs;
  terminal.hiddenSince = null;
  if (expiredWhileSuspended) {
    const sessionId = terminal.sessionId;
    terminal.sessionId = null;
    terminal.starting = null;
    terminal.hiddenSince = null;
    terminal.generation += 1;
    terminal.status = "expired";
    terminal.output = [];
    terminal.outputBytes = 0;
    if (sessionId) void closeTerminal(sessionId).catch(() => undefined);
  }
  terminal.listeners.add(listener);
  for (const data of terminal.output) {
    listener({ type: "output", data: Array.from(data) });
  }
  if (terminal.status === "exited") listener({ type: "exited" });
  if (terminal.status === "expired") listener({ type: "expired" });
  return () => terminal.listeners.delete(listener);
}

export async function ensureTerminalSession(tabId: string, cwd: string | null, cols: number, rows: number) {
  const terminal = managedTerminal(tabId, cwd);
  if (terminal.starting) return terminal.starting;
  if (terminal.status === "running" || terminal.status === "exited") return;
  terminal.status = "running";
  terminal.output = [];
  terminal.outputBytes = 0;
  const generation = ++terminal.generation;
  terminal.starting = startTerminal(cwd, cols, rows, (event) => {
    if (managedTerminals.get(tabId) !== terminal || terminal.generation !== generation) {
      return;
    }
    if (event.type === "output") {
      appendTerminalOutput(terminal, event.data);
    } else {
      terminal.status = "exited";
    }
    for (const listener of terminal.listeners) listener(event);
  })
    .then((sessionId) => {
      if (managedTerminals.get(tabId) !== terminal || terminal.generation !== generation) {
        void closeTerminal(sessionId);
        return;
      }
      terminal.sessionId = sessionId;
    })
    .catch((error: unknown) => {
      if (terminal.generation === generation) terminal.status = "new";
      throw error;
    })
    .finally(() => {
      terminal.starting = null;
    });
  return terminal.starting;
}

export async function writeTerminalSession(tabId: string, data: string) {
  const terminal = managedTerminals.get(tabId);
  if (terminal?.starting) await terminal.starting;
  const sessionId = terminal?.sessionId;
  if (sessionId) await writeTerminal(sessionId, data);
}

export async function resizeTerminalSession(tabId: string, cols: number, rows: number) {
  const terminal = managedTerminals.get(tabId);
  if (terminal?.starting) await terminal.starting;
  const sessionId = terminal?.sessionId;
  if (sessionId) await resizeTerminal(sessionId, cols, rows);
}

export function detachTerminalSession(tabId: string) {
  const terminal = managedTerminals.get(tabId);
  if (!terminal) return;
  terminal.hiddenSince = Date.now();
  scheduleTerminalExpiry(tabId, terminal);
}

export async function closeManagedTerminalSession(tabId: string) {
  const terminal = managedTerminals.get(tabId);
  if (!terminal) return;
  clearIdleTimer(terminal);
  managedTerminals.delete(tabId);
  if (terminal.sessionId) {
    await closeTerminal(terminal.sessionId).catch(() => undefined);
  }
}

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

export function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke("terminal_resize", { sessionId, cols, rows });
}

export function closeTerminal(sessionId: string): Promise<void> {
  return invoke("terminal_close", { sessionId });
}
