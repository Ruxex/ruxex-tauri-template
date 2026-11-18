import { i18n } from "@/app/i18n";
import { useTranslation } from "react-i18next";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

import {
  detachTerminalSession,
  ensureTerminalSession,
  resizeTerminalSession,
  subscribeTerminalSession,
  writeTerminalSession,
} from "@/platform/terminal";

export function TerminalPane({ tabId, cwd }: { tabId: string; cwd: string | null }) {
  const { t } = useTranslation("capabilities");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasExited, setHasExited] = useState(false);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
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

    const unsubscribe = subscribeTerminalSession(tabId, cwd, (event) => {
      if (event.type === "output") {
        terminal.write(Uint8Array.from(event.data));
      } else if (event.type === "exited") {
        setHasExited(true);
        terminal.write(`\r\n[${i18n.t("processExited", { ns: "capabilities", lng: i18n.resolvedLanguage })}]\r\n`);
      } else {
        setHasExpired(true);
        terminal.write(
          `\r\n[${i18n.t("terminalSessionExpired", { ns: "capabilities", lng: i18n.resolvedLanguage })}]\r\n`,
        );
      }
    });
    const onData = terminal.onData((data) => {
      void writeTerminalSession(tabId, data).catch((error: unknown) => {
        if (mounted) setStartError(errorMessage(error));
      });
    });

    const fitAndResize = () => {
      if (container.clientWidth === 0) return;
      const dimensions = fitAddon.proposeDimensions();
      if (!dimensions || dimensions.cols < 2 || dimensions.rows < 1) return;
      fitAddon.fit();
      void resizeTerminalSession(tabId, dimensions.cols, dimensions.rows).catch(() => undefined);
    };
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    const frame = window.requestAnimationFrame(() => {
      const dimensions = fitAddon.proposeDimensions();
      if (dimensions && dimensions.cols > 1 && dimensions.rows > 0) {
        fitAddon.fit();
      }
      void ensureTerminalSession(tabId, cwd, dimensions?.cols ?? 80, dimensions?.rows ?? 24)
        .then(() => {
          if (!mounted) return;
          const fitted = fitAddon.proposeDimensions();
          if (fitted) {
            fitAddon.fit();
            void resizeTerminalSession(tabId, fitted.cols, fitted.rows).catch(() => undefined);
          }
          terminal.focus();
        })
        .catch((error: unknown) => {
          if (mounted) setStartError(errorMessage(error));
        });
    });

    return () => {
      mounted = false;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      onData.dispose();
      unsubscribe();
      detachTerminalSession(tabId);
      terminal.dispose();
    };
  }, [cwd, tabId]);

  return (
    <section aria-label={t("terminal")} className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      {startError && (
        <div className="border-b border-error/40 bg-error/10 px-3 py-2 text-xs text-error" role="alert">
          {t("unableToStartTerminal", { details: startError })}
        </div>
      )}
      {hasExited && (
        <span className="sr-only" role="status">
          {t("terminalProcessExited")}
        </span>
      )}
      {hasExpired && (
        <div className="border-b border-white/10 bg-[#2a2a2a] px-3 py-1.5 text-xs text-white/75" role="status">
          {t("terminalSessionExpired")}
        </div>
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
