import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

import {
  closeTerminal,
  resizeTerminal,
  startTerminal,
  writeTerminal,
} from "../../platform/terminal";

export function TerminalPane({
  cwd,
  isOpen,
}: {
  cwd: string | null;
  isOpen: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasExited, setHasExited] = useState(false);
  isOpenRef.current = isOpen;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    mountedRef.current = true;
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const onData = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void writeTerminal(sessionId, data).catch((error: unknown) => {
          if (mountedRef.current) setStartError(errorMessage(error));
        });
      }
    });

    const fitAndResize = () => {
      if (!isOpenRef.current || container.clientWidth === 0) return;
      const dimensions = fitAddon.proposeDimensions();
      if (!dimensions || dimensions.cols < 2 || dimensions.rows < 1) return;
      fitAddon.fit();
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void resizeTerminal(sessionId, dimensions.cols, dimensions.rows).catch(
          () => undefined,
        );
      }
    };
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    return () => {
      mountedRef.current = false;
      resizeObserver.disconnect();
      onData.dispose();
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) void closeTerminal(sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || startingRef.current || sessionIdRef.current) return;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;

    startingRef.current = true;
    setStartError(null);
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const dimensions = fitAddon.proposeDimensions();
      if (dimensions && dimensions.cols > 1 && dimensions.rows > 0) {
        fitAddon.fit();
      }
      void startTerminal(
        cwd,
        dimensions?.cols ?? 80,
        dimensions?.rows ?? 24,
        (event) => {
          if (!mountedRef.current) return;
          if (event.type === "output") {
            terminal.write(Uint8Array.from(event.data));
          } else {
            setHasExited(true);
            terminal.write("\r\n[Process exited]\r\n");
          }
        },
      )
        .then((sessionId) => {
          if (cancelled) {
            void closeTerminal(sessionId);
            return;
          }
          sessionIdRef.current = sessionId;
          terminal.focus();
          const fitted = fitAddon.proposeDimensions();
          if (fitted) {
            fitAddon.fit();
            void resizeTerminal(sessionId, fitted.cols, fitted.rows).catch(
              () => undefined,
            );
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) setStartError(errorMessage(error));
        })
        .finally(() => {
          startingRef.current = false;
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (startingRef.current) startingRef.current = false;
    };
  }, [cwd, isOpen]);

  useEffect(() => {
    if (isOpen) {
      terminalRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <section
      aria-label="Terminal"
      className="flex h-full min-h-0 flex-col bg-[#1e1e1e]"
    >
      {startError && (
        <div
          className="border-b border-error/40 bg-error/10 px-3 py-2 text-xs text-error"
          role="alert"
        >
          Unable to start terminal: {startError}
        </div>
      )}
      {hasExited && (
        <span className="sr-only" role="status">
          Terminal process exited
        </span>
      )}
      <div
        className="min-h-0 flex-1 px-2 py-2 [&_.xterm]:h-full"
        data-testid="terminal-container"
        ref={containerRef}
      />
    </section>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
