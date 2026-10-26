# AppServer Settings Design

## Intent

Expose the Ruxex managed AppServer lifecycle in the Desktop Settings area so a user can inspect and recover the daemon without using a terminal. This directly addresses stale or crashed daemon processes that prevent JSON-RPC traffic from reaching the app.

## Goals

- Add an `AppServer` section under Settings.
- Expose daemon `Version`, `Start`, `Restart`, and `Stop` operations through Tauri commands.
- Show lifecycle status, AppServer version, PID, and socket path when available.
- Refresh the Tauri connection state after lifecycle operations.
- Keep the existing web/mock runtime behavior unchanged.

## Non-goals

- Add a log viewer or editable daemon configuration.
- Change the AppServer JSON-RPC protocol.
- Automatically stop or restart a daemon without an explicit user action.

## Approaches

1. **Native Tauri lifecycle commands (selected).** Rust calls `ruxex-app-server-daemon` directly. Example builds use `run_with_host_executable` with the current Desktop executable; non-example builds use the packaged daemon API. The Settings page calls typed Tauri wrappers and renders lifecycle controls. This preserves the existing product home and provider-specific daemon wiring.
2. **Expose only existing connect/ensure commands.** This cannot reliably stop or restart a stale daemon, so it does not meet the recovery goal.
3. **Spawn an external CLI from the frontend.** This introduces path, environment, and product-home mismatches and bypasses the daemon API already available to the Rust host.

## Design

- Add a serializable daemon status/control response based on `ruxex_app_server_daemon::LifecycleOutput`.
- Add a Tauri command accepting `start`, `restart`, `stop`, or `version`, mapping to `LifecycleCommand` and returning the lifecycle output.
- Keep daemon control serialized by the daemon API's existing operation lock.
- Add `src/app-server/daemon-api.ts` and a small React hook for query/mutation state.
- Add `/settings/app-server`, a sidebar link, and an `AppServerCard` with explicit lifecycle buttons.
- Disable controls while an operation is pending and show command errors inline.
- After Start/Restart, refresh the existing connection/status queries; after Stop, clear the local connection state.

## Constraints

- Preserve all unrelated uncommitted changes in the template repository.
- Use the existing Settings panel/card styling and React Query conventions.
- Test the Rust command mapping and the frontend API/card behavior before claiming completion.
