# Thread Summary Terminal Implementation Plan

> **For agentic workers:** Implement inline in the existing main checkout. Steps use checkbox syntax for tracking.

**Goal:** Add a Terminal action to the thread summary that opens an interactive default shell in a new global right-pane tab.

**Architecture:** The frontend renders a lazy xterm.js terminal tab and calls dedicated Tauri commands. The Rust backend owns portable PTY sessions and streams output over a Tauri IPC Channel.

**Tech Stack:** React, TypeScript, `@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0, Tauri 2 IPC Channels, Rust, `portable-pty` 0.9.0.

**Spec:** `docs/superpowers/specs/2026-11-13-thread-summary-terminal-design.md`

## Global Constraints

- Start only a shell explicitly requested by the user through the Terminal action.
- Do not use AppServer protocol for interactive terminal input/output.
- Use `thread.cwd` when it exists; use the user's home directory only when no workspace is configured.
- Close the PTY with its tab and when the desktop app exits.
- Preserve existing right-pane tab behavior and lazy-load the terminal viewer.

## Review Focus

- Invalid or removed workspace paths produce a visible error and no shell in a different directory.
- Multiple Terminal actions create independent sessions.
- Hidden terminal tabs remain mounted and keep their PTYs alive.
- Closing one terminal tab cannot terminate another terminal session.
- Terminal input, UTF-8 output, and zero-sized/rapid resize events are handled safely.

---

### Task 1: Tauri PTY session backend

**Files:**
- Create: `src-tauri/src/terminal.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`

**Interfaces:**
- `terminal_start(cwd: Option<String>, cols: u16, rows: u16, on_event: Channel<TerminalEvent>) -> Result<String, String>`
- `terminal_write(session_id: String, data: String) -> Result<(), String>`
- `terminal_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String>`
- `terminal_close(session_id: String) -> Result<(), String>`

- [x] Add the portable PTY dependency and implement shell resolution, workspace validation, session ownership, and output streaming.
- [x] Register backend state and four Tauri commands.
- [x] Run `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features --lib` and resolve all compile errors.

### Task 2: xterm terminal view and native bridge

**Files:**
- Create: `src/platform/terminal.ts`
- Create: `src/components/terminal/TerminalPane.tsx`
- Modify: `package.json` and `pnpm-lock.yaml`

**Interfaces:**
- `startTerminal(cwd: string | null, cols: number, rows: number, onEvent: (event: TerminalEvent) => void): Promise<string>`
- `writeTerminal(sessionId: string, data: string): Promise<void>`
- `resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>`
- `closeTerminal(sessionId: string): Promise<void>`

- [x] Add stable xterm and fit-addon dependencies and define typed native IPC wrappers.
- [x] Implement xterm mount, input/output forwarding, fit and resize observation, startup errors, and PTY cleanup.
- [x] Run `pnpm typecheck` and `pnpm lint`.

### Task 3: Thread summary and right-pane tab integration

**Files:**
- Modify: `src/app/app-outlet-context.ts`
- Modify: `src/pages/ThreadPage.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/thread-summary/ThreadSummaryPanel.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- `openThreadTerminal(target: { threadId: string; cwd: string | null }): void`
- Extend `RightPaneTab` with a terminal tab containing a stable frontend tab ID and optional `cwd`.

- [x] Pass the terminal action from the summary through outlet context.
- [x] Create an independent Terminal tab per action and render terminal content lazily while preserving inactive tab contents.
- [x] Keep last-tab close behavior and verify the existing right pane remains functional with `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
