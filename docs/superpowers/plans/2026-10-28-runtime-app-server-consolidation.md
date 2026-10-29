# Runtime AppServer Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remote AppServer support from the Desktop/Tauri repository and consolidate local connection and lifecycle status under Settings > Runtime > AppServer.

**Architecture:** Keep `ensure_app_server` as the only Desktop connection entry point for the local daemon or in-process server. Remove remote endpoint types, commands, validation, UI, and tests from `ruxex-tauri-template`; merge the existing local connection status and reconnect controls into `AppServerCard`.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest, Rust/Tauri, Cargo.

**Spec:** `docs/superpowers/specs/2026-10-28-runtime-app-server-consolidation-design.md`

## Global Constraints

- Change only `ruxex-tauri-template`; leave the sibling original `ruxex` repository untouched.
- Remove remote support from the Desktop/Tauri implementation, not from shared/original Ruxex.
- Preserve local Unix-socket and in-process AppServer behavior and lifecycle controls.
- Preserve the existing AppServer JSON-RPC request/event behavior.
- Do not add a replacement Connections settings section.
- Preserve unrelated existing working-tree changes.

## Review Focus

- Runtime AppServer still shows connected/disconnected state, AppServer version, live synchronization state, and reconnect control in one panel; cover in `AppServerPage.test.tsx` and the card layout test.
- InProcess mode still hides daemon-only fields and lifecycle controls; retain coverage in `AppServerPage.test.tsx` and `useAppServerDaemon.test.tsx`.
- Stopping or failing a local daemon action clears the single status cache; update `useAppServerDaemon.test.tsx` after removing the obsolete connection cache.
- Remote endpoint symbols and settings UI are absent from the Desktop repository; verify with `rg` and focused absence assertions where practical.
- The Tauri command list no longer exposes remote connect/disconnect/status commands while local `ensure_app_server` remains registered; cover with Rust compilation/tests and source search.

### Task 1: Remove remote endpoint and connection bridge contracts

**Files:**
- Modify: `src/app-server/api.ts`
- Modify: `src/app-server/api.test.ts`
- Delete: `src/app-server/hooks/useAppServerConnection.ts`
- Delete: `src/app-server/hooks/useAppServerConnection.test.tsx`
- Modify: `src/app-server/hooks/index.ts`
- Modify: `src-tauri/src/app_server.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/platform.rs`
- Modify: `src-tauri/src/platform.rs` tests

**Interfaces:**
- `AppServerStatus` retains `socketPath`, `appServerVersion`, and optional `mode`; it no longer contains `endpointKind`.
- `api.ts` retains `ensureAppServer`, request, and server-request resolution functions; it no longer exports endpoint/connect/disconnect/connection-status functions.
- Rust retains `ensure_app_server`, daemon control, request forwarding, and event forwarding; it removes `AppServerEndpoint`, WebSocket connection code, and the three unused connection commands.

- [ ] **Step 1: Update frontend and Rust tests to express local-only contracts.** Remove remote API/hook tests, remove `endpointKind` fixtures, change daemon cache assertions to use only `appServerQueryKeys.status`, and remove Rust tests for WebSocket endpoint serialization and remote-preservation behavior.
- [ ] **Step 2: Run the focused tests to verify the expected failures.**
  - Run: `pnpm vitest run src/app-server/api.test.ts src/app-server/hooks/useAppServerDaemon.test.tsx src/platform/platform-model.test.ts`
  - Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml app_server::tests platform::tests`
  - Expected: failures identify production references to the removed contracts.
- [ ] **Step 3: Remove the remote contracts and commands.** Delete the remote endpoint union and bridge functions from `api.ts`; delete the connection hook and export; remove WebSocket endpoint types/connection branch/commands from `src-tauri/src/app_server.rs`; unregister those commands in `src-tauri/src/lib.rs`; remove `validate_remote_endpoint` and its test from Rust platform helpers.
- [ ] **Step 4: Simplify lifecycle cache handling.** Make daemon control clear the single local status cache for non-version actions and update the hook tests accordingly.
- [ ] **Step 5: Run the focused frontend and Rust tests.**
  - Run: `pnpm vitest run src/app-server/api.test.ts src/app-server/hooks/useAppServerDaemon.test.tsx`
  - Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml app_server::tests platform::tests`
  - Expected: PASS.

### Task 2: Remove the remote settings surface and consolidate local status into Runtime

**Files:**
- Modify: `src/pages/SettingsOverviewPage.tsx`
- Modify: `src/pages/AppServerPage.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/pages/AppServerPage.test.tsx`
- Modify: `src/components/settings/SettingsLayout.test.tsx`
- Delete: `src/components/connection/RemoteConnectionCard.tsx`
- Delete: `src/components/connection/RemoteConnectionCard.test.tsx`
- Modify: `src/platform/platform-model.ts`
- Modify: `src/platform/platform-model.test.ts`

**Interfaces:**
- `AppServerCard` accepts the existing daemon props plus `connected`, `resynchronizing`, `connectionError`, `isFetching`, and `onReconnect`.
- `AppServerPage` uses `useAppServerDaemon`, `useAppServerStatus`, and `useAppServerEvents` and renders one AppServer settings panel containing connection and lifecycle information.
- `SettingsOverviewPage` contains only general preferences and no AppServer/remote connection cards.

- [ ] **Step 1: Write the failing UI tests.** Assert that Runtime/AppServer renders connection status, live state, version, reconnect, and daemon controls together; assert that General no longer renders Connection or Remote App Server; retain InProcess behavior assertions.
- [ ] **Step 2: Run the focused UI tests to verify they fail for the intended missing behavior.**
  - Run: `pnpm vitest run src/pages/AppServerPage.test.tsx src/components/settings/SettingsLayout.test.tsx src/platform/platform-model.test.ts`
  - Expected: failures show the old separate ConnectionCard/remote surface and old component contract.
- [ ] **Step 3: Merge the local connection display into `AppServerCard`.** Preserve existing row labels and reconnect behavior, add connection/live-state props, and keep daemon-only fields/actions conditional on daemon mode.
- [ ] **Step 4: Move the status/event hooks to `AppServerPage` and remove the General connection wiring.** Delete the remote card and its tests; remove the unused remote endpoint validation type/function and tests.
- [ ] **Step 5: Run the focused UI tests.**
  - Run: `pnpm vitest run src/pages/AppServerPage.test.tsx src/components/settings/SettingsLayout.test.tsx src/platform/platform-model.test.ts`
  - Expected: PASS.

### Task 3: Full Desktop/Tauri verification and cleanup

**Files:**
- Verify: all files in Tasks 1–2 and the working-tree diff in `ruxex-tauri-template`.

- [ ] **Step 1: Search the Desktop repository for removed remote symbols.**
  - Run: `rg -n "RemoteConnection|RemoteEndpoint|validateRemoteEndpoint|validate_remote_endpoint|endpointKind|AppServerEndpoint|connect_app_server|disconnect_app_server|app_server_connection_status|useAppServerConnection" src src-tauri`
  - Expected: no matches, except no intentional compatibility references.
- [ ] **Step 2: Run the complete frontend suite and static checks.**
  - Run: `make check-tests`
  - Expected: TypeScript, Biome, ESLint, and Vitest all pass.
- [ ] **Step 3: Run the complete Rust/Tauri suite.**
  - Run: `make rust-test`
  - Expected: all tests pass.
- [ ] **Step 4: Inspect the final diff and confirm scope.**
  - Run: `git -C ruxex-tauri-template diff --check` and `git -C ruxex-tauri-template status --short`
  - Expected: only the approved Desktop/Tauri files and design/plan docs are changed; sibling `ruxex` has no changes from this work.

No commit is planned because the repository instructions require an explicit user request before committing.
