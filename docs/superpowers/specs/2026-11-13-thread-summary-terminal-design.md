# Thread Summary Terminal Tab

## Intent

Let a user open an interactive terminal from the thread summary in the global right pane. The terminal runs the user's default shell in the thread workspace when available, or the user's home directory when the thread has no workspace.

## Architecture

- Reuse the global right-pane tabs owned by `AppLayout`.
- Add a Terminal action to `ThreadSummaryPanel`, and pass its callback through `ConversationWorkspace`, `ThreadPage`, and outlet context.
- Render terminal content with `@xterm/xterm` and `@xterm/addon-fit`.
- Spawn and manage the interactive shell in the Tauri backend with `portable-pty`; do not use AppServer shell/process protocol methods.
- Stream PTY output to the frontend through a Tauri IPC `Channel`. Forward terminal input, dimensions, and close requests through Tauri commands.
- Each explicit Terminal action creates a new terminal tab/session. Closing its tab terminates its PTY. Hiding the pane or selecting another tab keeps its shell alive.

## Shell and working directory

- On Unix, use a valid `SHELL` value first, then the current account's configured shell, then `/bin/sh`. Start it as a login interactive shell so the user's terminal startup configuration is loaded.
- On Windows, use `COMSPEC`, with `cmd.exe` as the fallback.
- Use `thread.cwd` when it is an existing directory. If it is absent, use the user's home directory. If a provided workspace path no longer exists, report the startup error in the terminal.
- Pass no user-entered command or shell arguments. The only process command is the resolved shell executable.

## Lifecycle and presentation

- Create the PTY when the Terminal tab content mounts; fit it to the visible pane and propagate later size changes to the PTY.
- Keep tab contents mounted but hidden when inactive so shell state and terminal buffers survive tab changes.
- Stop the PTY when its tab closes or the application exits.
- Display startup failures in an accessible error state. Keep terminal input and output text unmodified so interactive terminal control sequences work.

## Scope

No terminal profiles/settings, split terminals, shell-command presets, persistent sessions across app restarts, or AppServer terminal protocol integration.

## Validation

- The thread summary action opens a Terminal tab in the existing right pane.
- The selected tab starts the default shell in `thread.cwd`; missing workspace starts in the user's home directory.
- Text input and terminal control keys reach the PTY, and output is rendered by xterm.
- Resizing the pane updates the PTY dimensions.
- Switching tabs keeps the shell alive; closing the tab terminates it and closing the last right-pane tab closes the pane.
- Missing workspace directories and shell startup errors are visible and do not break other tabs.
