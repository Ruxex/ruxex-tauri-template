# AppServer I/O Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show debug-build AppServer traffic in `tauri dev` standard output with colored `[tauri→]` and `[←app]` headers.

**Architecture:** Add a small shared formatter/logger to `ruxex-scheduler`, where both the desktop bridge and scheduler dispatcher can use it. Log typed request/response envelopes at the request boundaries and log forwarded AppServer events before the existing Tauri event emission. Compile the logger as a no-op in release builds.

**Tech Stack:** Rust 2024, `serde_json`, `ruxex-app-server-client`, Tauri 2, Cargo workspace tests.

**Spec:** `docs/superpowers/specs/2026-10-23-app-server-io-logging-design.md`

## Global Constraints

- Log only during debug builds; release builds must not emit request payloads by default.
- Use ANSI-colored headers `[tauri→]` and `[←app]`.
- Use compact JSON and standard output.
- Logging must not change AppServer protocol behavior or error handling.
- Do not add a logging dependency or persistent log file.
- Do not use a worktree.

## Review Focus

- A request that returns a normal response logs both directions with the same request id — test the pure formatter's exact headers and compact JSON.
- A server notification/request is logged before the existing Tauri event is emitted — inspect the event-loop placement and run the bridge tests.
- A server-request resolution/rejection is logged as Tauri-to-AppServer traffic — inspect both command paths and run Rust tests.
- Scheduler-dispatched requests are not omitted — test the scheduler request helper path and run scheduler tests.
- Serialization or transport errors do not make logging panic or alter the original error — run the complete workspace test suite and inspect the error branches.

---

### Task 1: Add and integrate the shared colored AppServer logger

**Files:**
- Modify: `crates/ruxex-scheduler/src/app_server.rs`
- Modify: `crates/ruxex-scheduler/src/lib.rs`
- Test: `crates/ruxex-scheduler/src/app_server.rs` (existing unit-test module)

**Interfaces:**
- Produces `pub enum AppServerLogDirection { ToAppServer, FromAppServer }`.
- Produces `pub fn format_app_server_log(direction: AppServerLogDirection, payload: &serde_json::Value) -> String` for deterministic tests and formatting.
- Produces `pub fn log_app_server_io<T: serde::Serialize>(direction: AppServerLogDirection, payload: &T)` that prints in debug builds and is a no-op in release builds.
- Keeps all existing public Tauri command signatures and scheduler dispatcher behavior unchanged.

- [x] **Step 1: Write the failing formatter test**

  Add a test named `formats_colored_app_server_direction_headers` that passes a JSON object through both directions and asserts the exact strings:

  - Tauri to AppServer: `\x1b[36m[tauri→]\x1b[0m {"method":"thread/start"}`
  - AppServer to Tauri: `\x1b[32m[←app]\x1b[0m {"type":"serverNotification"}`

- [x] **Step 2: Run the focused test to verify it fails**

  Run: `cargo test -p ruxex-scheduler formats_colored_app_server_direction_headers`

  Expected: FAIL because the formatter and direction type do not exist yet.

- [x] **Step 3: Implement the logger**

  Define the public direction enum, the deterministic formatter with cyan `36` for `[tauri→]` and green `32` for `[←app]`, and the generic logger. Serialize payloads with `serde_json::to_value`; if serialization fails, print a JSON-shaped serialization error rather than panic. Gate only the actual `println!` behind `#[cfg(debug_assertions)]`; keep the public function available in all builds.

- [x] **Step 4: Run the focused test to verify it passes**

  Run: `cargo test -p ruxex-scheduler formats_colored_app_server_direction_headers`

  Expected: PASS.

- [x] **Step 5: Implement scheduler logging**

  In `send_request`, log the serialized `ClientRequest` as `ToAppServer` before moving it into `handle.request`. Log a response envelope containing method, id, and result as `FromAppServer`; log transport and JSON-RPC errors as `FromAppServer` diagnostic envelopes before returning the same existing error strings.

- [x] **Step 6: Implement desktop-bridge logging**

  In `src-tauri/src/app_server.rs`:

  - Log `ClientRequest` as `ToAppServer` before `request_handle.request`.
  - Log the normal response envelope and transport/server error envelopes as `FromAppServer` without changing error mapping.
  - Log each converted `DesktopAppServerEvent` before emitting `app-server-event`.
  - Log `app_server_resolve_server_request` and `app_server_reject_server_request` payloads as `ToAppServer` before invoking the existing handle methods.

- [x] **Step 7: Run focused tests to verify the integration passes**

  Run: `cargo test -p ruxex-scheduler app_server` and `cargo test -p ruxex-desktop app_server`

  Expected: PASS with existing protocol, event, and scheduler behavior preserved.

### Task 2: Verify the complete workspace and formatting

**Files:**
- Verify: all modified Rust files and the two design/plan documents

- [x] **Step 1: Run Rust formatting check**

  Run: `cargo fmt --all -- --check`

  Expected: exit 0 with no formatting differences.

- [x] **Step 2: Run the complete Rust workspace test suite**

  Run: `cargo test --workspace`

  Expected: exit 0 with all workspace tests passing.

- [x] **Step 3: Run the existing frontend suite and type checks**

  Run: `pnpm test -- --run` and `pnpm typecheck`

  Expected: both commands exit 0; no frontend behavior was changed, but the full repository verification remains clean.

- [x] **Step 4: Inspect the final diff and status**

  Run: `git diff --check && git status --short`

  Expected: no whitespace errors; only the intended logging implementation and its documentation are present.
