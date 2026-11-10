# App Server Desktop Provider Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every local App Server daemon lifecycle operation uses the Tauri desktop executable that owns the compiled provider.

**Architecture:** Extract a small helper in `app_server.rs` that resolves `current_exe()` and invokes `run_with_host_executable` with the desktop daemon-mode arguments. Use it for both connection bootstrap and `app_server_daemon_control`; leave ForceStop and InProcess paths unchanged.

**Tech Stack:** Rust, Tauri commands, Ruxex `app-server-daemon` lifecycle API, Cargo tests.

**Spec:** `docs/superpowers/specs/2026-11-10-app-server-desktop-provider-host-design.md`

## Global Constraints

- The desktop executable is the provider composition root in every build configuration.
- Daemon host arguments are exactly `HOST_APP_SERVER_DAEMON_MODE_ARG` and `--managed-daemon`.
- The complete runtime package remains available for unrelated artifact/runtime resources.
- InProcess mode and PID-based ForceStop behavior remain unchanged.

## Review Focus

- Normal/default build lifecycle: no call to generic `run(command)` remains in the daemon control path; pin with a source-level Rust test or compile-checked helper.
- Initial daemon bootstrap: connection recovery uses the same desktop-host executable path as Start/Restart; pin with shared-helper usage and existing compilation.
- Example provider dispatch: child desktop process receives daemon mode args and reconstructs `default_config()`; pin with the host-argument contract.
- Stop and Version: they use the desktop host executable too, while ForceStop continues to use the PID file; pin with the helper's command forwarding and unchanged ForceStop tests.

### Task 1: Add the shared desktop-host lifecycle contract

**Files:**
- Modify: `src-tauri/src/app_server.rs` imports and daemon lifecycle branches
- Modify: `src-tauri/src/app_server.rs` unit tests

**Interfaces:**
- Consumes: `LifecycleCommand`, `HOST_APP_SERVER_DAEMON_MODE_ARG`, `run_with_host_executable`, and `DesktopConfig`-independent executable resolution.
- Produces: one internal async helper for host-owned lifecycle execution, used by both initial daemon bootstrap and the Tauri lifecycle command.

- [x] **Step 1: Write the failing contract test**

  Add a unit-level test for a pure helper that returns the host argument list and assert it is exactly `[HOST_APP_SERVER_DAEMON_MODE_ARG, "--managed-daemon"]`. Add a source/structure assertion or compile-visible helper boundary that the lifecycle path is represented by the shared helper rather than the generic `run` function.

- [x] **Step 2: Run the focused Rust test to verify it fails**

  Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml app_server::tests -- --nocapture`

  Expected: FAIL because the host-argument helper does not exist yet.

- [x] **Step 3: Implement the shared host lifecycle helper**

  Import `run_with_host_executable` unconditionally, add a helper that resolves `std::env::current_exe()` and calls `run_with_host_executable(command, &executable, &[HOST_APP_SERVER_DAEMON_MODE_ARG, "--managed-daemon"])`, and use it from both the non-example initial connection fallback and `app_server_daemon_control`. Remove the `bootstrap_from_package_with_host_args` and generic `run` imports/usages from `app_server.rs`.

- [x] **Step 4: Run the focused Rust test to verify it passes**

  Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml app_server::tests -- --nocapture`

  Expected: PASS, including the new host-argument contract and existing app-server tests.

### Task 2: Verify all supported build paths

**Files:**
- Modify: none beyond Task 1.

- [x] **Step 1: Run Rust formatting and tests**

  Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check && cargo test --locked --manifest-path src-tauri/Cargo.toml`

  Expected: exit 0 with formatting clean and all Rust tests passing.

- [x] **Step 2: Run the no-default-feature Rust tests**

  Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features`

  Expected: exit 0, proving the former generic-runtime build also compiles with the desktop-host path.

- [x] **Step 3: Run repository checks**

  Run: `pnpm test && pnpm check && git diff --check`

  Expected: all frontend tests, typecheck, lint, and whitespace checks pass.

- [x] **Step 4: Review the final diff**

  Confirm that only the shared lifecycle routing, its focused test, and the approved spec/plan documents changed; do not remove runtime-package artifact resources as part of this task.
