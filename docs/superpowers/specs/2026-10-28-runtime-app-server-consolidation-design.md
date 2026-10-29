# Runtime AppServer Consolidation Design

## Intent

Temporarily remove Desktop remote AppServer support and make Runtime > AppServer the single place for local AppServer connection and lifecycle state. This removes the duplicate-looking AppServer UI from General and keeps the Desktop surface focused on the managed local runtime.

## Goals

- Remove the Remote App Server settings card and its frontend/backend connection path.
- Remove the General Connection card; show its local connection status, version, live state, and reconnect action in Runtime > AppServer.
- Keep local daemon and InProcess startup, status, and Start/Restart/Stop controls working.
- Preserve the existing AppServer JSON-RPC request/event behavior.

## Non-goals

- Do not redesign daemon lifecycle behavior.
- Do not remove local Unix-socket or in-process AppServer connections.
- Do not add a replacement Connections settings section.

## Approaches

1. Keep remote APIs and hide only their UI. Rejected because the request explicitly removes the remote feature, leaving unused endpoint and Tauri command paths.
2. Remove remote support and merge the existing local Connection display into the Runtime AppServer card. Selected because it removes dead code and gives users one authoritative AppServer surface.

## Design

`AppServerStatus` becomes local-only and no longer carries an endpoint kind. The frontend removes `useAppServerConnection`, remote endpoint validation, and `RemoteConnectionCard`. The Tauri bridge unregisters and deletes the remote-capable connect/disconnect/status commands; `ensure_app_server` remains the local connection entry point.

`AppServerPage` reads the existing AppServer status and event state, then passes connection status, live synchronization state, and reconnect behavior into the existing `AppServerCard`. The card displays those fields alongside mode, daemon status, version, PID, socket, and lifecycle controls.

## Verification

Update focused frontend and Rust tests first, run them to observe the expected failures, then implement the smallest change that makes them pass. Finish with the repository's frontend checks and the desktop Rust test suite, plus a search confirming that remote connection symbols and UI are gone.
