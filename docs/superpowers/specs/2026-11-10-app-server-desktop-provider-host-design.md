# App Server Desktop Provider Host

## Intent

Make the Tauri desktop executable the composition root for the App Server
daemon in every build configuration. When the provider is compiled into the
desktop application, daemon startup and lifecycle control must not switch to
the generic managed `ruxex` binary.

## Goals

- Use the current `ruxex-desktop` executable for daemon start, restart, stop,
  and version lifecycle commands.
- Use the same desktop-host path when the initial daemon connection needs to
  bootstrap a daemon.
- Preserve the existing provider factory and product identity selected by the
  desktop binary, including Example providers.
- Keep the runtime package available for unrelated artifact/runtime resources.

## Non-goals

- Removing the complete `ruxex-package` bundle or its artifact tooling.
- Moving the daemon into the Tauri process or changing the App Server protocol.
- Changing InProcess mode behavior or ForceStop's PID-based fallback.

## Constraints

- `ruxex::desktop::daemon::run_with_host_executable` is the supported API for
  lifecycle control against a provider-owned executable.
- The child desktop process enters daemon mode through
  `HOST_APP_SERVER_DAEMON_MODE_ARG` and `--managed-daemon`.
- `main.rs` already dispatches that daemon mode through
  `run_host_app_server_daemon_with_config(default_config())`.

## Approaches

- **Chosen: desktop-host lifecycle everywhere.** Resolve `current_exe()` and
  invoke it with the daemon-mode arguments for both initial bootstrap and
  lifecycle controls, removing the `run(command)` and package-bootstrap paths
  from `app_server.rs`. This keeps the provider owned by the desktop binary
  while preserving process isolation.
- **Rejected: generic managed binary with provider configuration.** The
  generic package cannot own an arbitrary compiled provider factory and would
  reintroduce the provider mismatch during restart.
- **Rejected: in-process daemon.** This changes the existing lifecycle and
  isolation model and is unnecessary when the desktop executable can host the
  provider in a child process.

## Verification

Add Rust unit-level contracts for the lifecycle command argument construction
and run the Rust test suite, including both default and no-default-feature
configurations where available, plus formatting and the existing repository
checks.
