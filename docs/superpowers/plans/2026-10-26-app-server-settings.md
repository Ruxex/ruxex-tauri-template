# AppServer Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings > AppServer page that controls the Desktop-managed AppServer through the Ruxex daemon lifecycle API.

**Architecture:** Add one typed Tauri command that maps `start`, `restart`, `stop`, and `version` to `ruxex_app_server_daemon::LifecycleCommand`. Example builds use the current Desktop executable as the host; non-example builds use the packaged daemon API. Add a typed frontend wrapper and React Query hook, then render lifecycle state and controls in a dedicated Settings route.

**Tech Stack:** Rust/Tauri, `ruxex-app-server-daemon`, React, React Router, TanStack Query, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-26-app-server-settings-design.md`

## Global Constraints

- Preserve unrelated existing working-tree changes.
- Use the existing Settings panel/card styling and React Query conventions.
- Do not change the AppServer JSON-RPC protocol or add automatic lifecycle actions.
- Example builds must keep using the current Desktop executable so the shared Dummy Provider remains available.

## Review Focus

- A stale daemon must be recoverable with Restart; test command-to-lifecycle mapping and successful mutation state updates.
- A stopped daemon must not make the Settings page crash; test version-query errors as an unavailable/stopped state.
- Stop must clear the frontend's connection cache; test the connection/status query invalidation.
- Non-desktop/mock runtime must not invoke Tauri; test the no-op behavior used by browser tests.
- Errors from lifecycle operations must be shown inline and must re-enable controls; test card error rendering and pending state.

### Task 1: Add the Rust daemon lifecycle command

**Files:**
- Modify: `src-tauri/src/app_server.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/app_server.rs` unit tests

**Interfaces:**
- Produces Tauri command `app_server_daemon_control(action)`.
- Accepts serialized actions `start`, `restart`, `stop`, `version`.
- Returns the serialized `ruxex_app_server_daemon::LifecycleOutput` or the existing structured Desktop lifecycle error.

- [ ] **Step 1: Write the failing Rust tests** for action-to-`LifecycleCommand` conversion and serialized action names.
- [ ] **Step 2: Run the focused Rust test** and confirm it fails because the action type/conversion is absent.
- [ ] **Step 3: Implement the command** with `run_with_host_executable` under `feature = "example"`, `run` otherwise, and register it in `tauri::generate_handler!`.
- [ ] **Step 4: Run the focused Rust tests** and then `cargo test -p ruxex-desktop --lib`.

### Task 2: Add the typed frontend daemon API and hook

**Files:**
- Create: `src/app-server/daemon-api.ts`
- Create: `src/app-server/hooks/useAppServerDaemon.ts`
- Create: `src/app-server/hooks/useAppServerDaemon.test.tsx`
- Modify: `src/app-server/hooks/index.ts`
- Modify: `src/app-server/query-keys.ts`

**Interfaces:**
- `AppServerDaemonAction = "start" | "restart" | "stop" | "version"`.
- `AppServerDaemonOutput` mirrors the camelCase `LifecycleOutput` fields.
- `controlAppServerDaemon(action)` invokes `app_server_daemon_control`.
- `useAppServerDaemon()` exposes `status`, `control`, and lifecycle-derived pending/error state.

- [ ] **Step 1: Write failing Vitest tests** for invoke payloads, version status handling, action mutation, and connection cache updates.
- [ ] **Step 2: Run the focused Vitest file** and confirm the new API/hook behavior fails.
- [ ] **Step 3: Implement the API and hook** using the existing `isDesktopRuntime`, query keys, and QueryClient conventions.
- [ ] **Step 4: Run the focused Vitest file** and confirm all cases pass.

### Task 3: Add the AppServer Settings UI and route

**Files:**
- Create: `src/pages/AppServerPage.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/pages/AppServerPage.test.tsx`
- Modify: `src/components/settings/SettingsSections.test.tsx`

**Interfaces:**
- `AppServerCard` renders status, version, PID, socket path, inline errors, and `Start`, `Restart`, `Stop` controls.
- `AppServerPage` uses `useAppServerDaemon`, disables controls while pending, and delegates actions to the hook.
- Route: `/settings/app-server`; sidebar label: `AppServer`.

- [ ] **Step 1: Write failing component tests** for the sidebar route, lifecycle fields, disabled pending controls, error display, and action callbacks.
- [ ] **Step 2: Run focused Vitest tests** and confirm they fail before the route/card exists.
- [ ] **Step 3: Implement the card, page, sidebar link, and router entry** using existing `SettingsPanel`, `SettingRow`, and button styles.
- [ ] **Step 4: Run focused component tests** and confirm they pass.

### Task 4: Full verification and handoff

**Files:**
- Verify all files above and the generated `Cargo.lock` if dependency resolution changes it.

- [ ] **Step 1: Run `cargo fmt --all -- --check` and `git diff --check`.**
- [ ] **Step 2: Run `cargo test -p ruxex-desktop`.**
- [ ] **Step 3: Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.**
- [ ] **Step 4: Review the final diff and confirm unrelated existing changes remain untouched.**
