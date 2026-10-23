# AppServer I/O logging design

## Intent

When running `tauri dev`, make the AppServer traffic visible in the Tauri
process's standard output. Use colored direction headers such as
`[tauri→]` for messages sent by the desktop app and `[←app]` for messages
received from AppServer.

## Goals

- Log outgoing AppServer requests and incoming responses in the Tauri bridge.
- Log incoming AppServer notifications and server requests.
- Log outgoing resolutions/rejections for AppServer server requests.
- Include AppServer traffic initiated by the scheduler, which uses the shared
  request handle directly.
- Keep the output readable as compact JSON with ANSI-colored headers.
- Limit this diagnostic logging to debug builds so release applications do not
  emit request payloads by default.

## Non-goals and anti-goals

- No frontend console or UI logging.
- No change to the AppServer protocol or public Tauri command payloads.
- No dependency on a global logging framework for this small diagnostic aid.
- Do not log connection credentials or add a separate persistent log file.

## Approaches

1. **Log at the desktop bridge and scheduler dispatch boundaries (chosen).**
   This covers the existing Tauri command path and the scheduler's direct
   handle path with a small, local change and keeps the output format under
   this repository's control.
2. Enable wire-level tracing in the AppServer client dependency. This could
   capture more internals, but depends on external tracing APIs and provides
   less control over the requested headers and formatting.
3. Log from the frontend. This would not appear in `tauri dev`'s standard
   output and would miss scheduler traffic, so it does not fit the request.

## Design

Add a small debug-only logging helper that writes one direction-colored header
and one compact JSON value per message. Call it immediately before and after
`AppServerRequestHandle::request` in the desktop bridge and scheduler
dispatcher. Convert typed protocol values to JSON at the log boundary; log
transport/server errors as JSON-shaped diagnostic values without changing the
existing error handling.

The event forwarding task logs notifications, server requests, lag events,
and disconnects as AppServer-to-Tauri messages before emitting the existing
Tauri event. Server-request resolution and rejection log as Tauri-to-AppServer
messages before invoking the existing handle methods.

The helper is compiled as a no-op in release builds. Tests will cover header
direction/color selection and the JSON serialization shape through a pure
formatting function, while the existing Rust test suite and formatting checks
will verify integration.

## Builder decisions

- Use ANSI escape sequences directly; `tauri dev` is a terminal-oriented
  workflow and adding a logging dependency is unnecessary.
- Use compact JSON so each message remains easy to scan and grep.
- Preserve all existing protocol/error behavior; logging failures must never
  affect AppServer communication.
