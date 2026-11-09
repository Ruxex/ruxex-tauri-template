# Settings Runtime Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Desktop runtime data directory near provider information and expose the complete Unix socket path on hover in Settings.

**Architecture:** Extend the native `AppServerStatus` response with the resolved Desktop runtime home, mirror it in the frontend status type, and pass it from the existing app-server status query into the Models page's provider card. Keep the socket value in the App Server card with truncation for layout and a `title` containing the full path.

**Tech Stack:** Rust/Tauri, React, TypeScript, TanStack Query, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-settings-runtime-paths-design.md`

## Global Constraints

- The UI label for the native home path is exactly `Data directory`.
- The frontend transport field is `homeDataDir`; the Rust serde field is `homeDataDir` via `rename_all = "camelCase"`.
- The socket row label is exactly `UnixSocket`.
- Do not add path editing controls or duplicate `Data directory` in the App Server card.
- Preserve existing unavailable-state fallbacks and settings-card layout conventions.

## Review Focus

- Native daemon and in-process modes must report the same resolved data directory; pin both status constructors in Rust tests.
- Older/mock status objects without the optional frontend field must render `Unavailable`, pin the Model page fallback.
- Long Unix socket paths must remain visually truncated while retaining the full `title`, pin the App Server card metadata.
- The user-facing label must not leak the implementation name `HomeDataDir`, pin the provider-card assertion.

### Task 1: Return the resolved data directory from native app-server status

**Files:**
- Modify: `src-tauri/src/app_server.rs`
- Test: `src-tauri/src/app_server.rs` unit tests

**Interfaces:**
- Produces `AppServerStatus.homeDataDir` as the absolute resolved Desktop runtime home path.
- Keeps `socketPath`, `appServerVersion`, and `mode` unchanged.

- [ ] **Step 1: Write the failing Rust serialization test** for `AppServerStatus` asserting `homeDataDir` is present alongside the existing fields.
- [ ] **Step 2: Run the focused Rust test** with `cargo test -p ruxex-desktop app_server_status_keeps_the_local_bridge_contract --lib` and verify it fails because `homeDataDir` is absent.
- [ ] **Step 3: Add `home_data_dir: String` to `AppServerStatus`** and populate it from the resolved `home` path in both daemon and in-process status constructors.
- [ ] **Step 4: Run the focused Rust test** and then `cargo test -p ruxex-desktop app_server_status --lib` to verify serialization and related status tests pass.

### Task 2: Wire the status field into the provider settings card

**Files:**
- Modify: `src/app-server/api.ts`
- Modify: `src/components/settings/ProviderAccountCard.tsx`
- Modify: `src/pages/ModelPage.tsx`
- Test: `src/pages/ModelPage.test.tsx`

**Interfaces:**
- Consumes `AppServerStatus.homeDataDir` from Task 1.
- `ProviderAccountCard` accepts `dataDirectory: string` and renders it with the label `Data directory`.

- [ ] **Step 1: Write the failing Model page tests** for rendering the resolved data directory and falling back to `Unavailable` when the status field is absent.
- [ ] **Step 2: Run `pnpm vitest run src/pages/ModelPage.test.tsx`** and verify the new assertions fail because the status is not wired and the card has no row.
- [ ] **Step 3: Add optional `homeDataDir?: string` to `AppServerStatus`**, call `useAppServerStatus()` in `ModelPage`, pass `status.data?.homeDataDir ?? "Unavailable"`, and render the `Data directory` row in `ProviderAccountCard`.
- [ ] **Step 4: Run the focused Model page tests** and verify both rendering cases pass.

### Task 3: Make the Unix socket full path discoverable on hover

**Files:**
- Modify: `src/components/settings/AppServerCard.tsx`
- Test: `src/pages/AppServerPage.test.tsx`

**Interfaces:**
- Consumes the existing `daemon.socketPath` value.
- Keeps the existing truncation layout and exposes the same value through the rendered element's `title`.

- [ ] **Step 1: Write the failing App Server page assertion** for the `UnixSocket` label and the full `title` value on a long socket path.
- [ ] **Step 2: Run `pnpm vitest run src/pages/AppServerPage.test.tsx`** and verify it fails because the label is still `Socket`.
- [ ] **Step 3: Rename the row to `UnixSocket`** while preserving `truncate`, `font-mono`, and `title={daemon.socketPath}`.
- [ ] **Step 4: Run the focused App Server page tests** and verify the label and hover metadata pass.

### Task 4: Full verification

**Files:**
- Verify the files changed in Tasks 1–3 and the design/plan documents.

- [ ] **Step 1: Run formatting and diff checks:** `cargo fmt --all -- --check`, `pnpm exec biome format --check src src-tauri`, and `git diff --check`.
- [ ] **Step 2: Run the Rust suite:** `cargo test -p ruxex-desktop`.
- [ ] **Step 3: Run the frontend suite and static checks:** `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] **Step 4: Review the final diff** to confirm only the requested settings behavior and its tests/docs changed.
