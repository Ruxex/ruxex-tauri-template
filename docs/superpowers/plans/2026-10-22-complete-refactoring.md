# Complete Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved scheduler, Rust boundary, event-store, React component, and cleanup refactors while preserving the template's public behavior and committing each independently testable unit.

**Architecture:** Keep the existing Tauri/React/file-backed design and extract focused modules behind current boundaries. Correct schedule semantics in the domain first, then move orchestration and UI onto the new interfaces before performing independent store, navigation, settings, and cleanup refactors.

**Tech Stack:** Rust 2024, Tauri 2, Tokio, Chrono with `chrono-tz`, React 19, TypeScript 5.9, TanStack Query 5, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-refactoring-design.md`

## Global Constraints

- Keep the existing Tauri, React, TanStack Query, and file-backed schedule architecture.
- Do not add dependencies for file movement or abstraction; `chrono-tz` is allowed for IANA timezone correctness.
- Preserve App Server and Tauri command payloads except for the approved atomic schedule input extension.
- Decode existing `schedules.json` records that lack `timeZone`.
- Do not modify the generated protocol snapshot.
- Keep every task buildable and commit it separately after focused tests pass.
- Preserve the serialized `DesktopAppServerError` contract and current accessibility labels.

## Review Focus

- An old recurring record without `timeZone` must use the host system timezone rather than UTC; Task 1 adds a legacy decoding and calculation test.
- A recurring local time inside a DST gap must advance to the next valid minute, while an ambiguous time uses the first occurrence; Task 1 adds both tests.
- A schedule edited or deleted during an in-flight dispatch must not be reverted or recreated; Task 2 adds merge/delete tests.
- An event identity outside the newest 200 entries may re-enter, but duplicates inside the window must remain suppressed; Task 4 tests both boundaries.
- Unknown routes must resolve to the home panel without breaking exact account/settings matching; Task 6 adds route-mapping table tests.

---

Preconditions already committed:

- `f4b5c38` preserves the pre-refactor working state.
- `a15d228` adds the approved architectural design.

### Task 1: Timezone-aware and atomic schedule domain

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/scheduler.rs`

**Interfaces:**
- Produces: recurring `ScheduleCadence` variants with `time_zone: Option<String>` serialized as `timeZone`.
- Produces: `ScheduleInput { name, prompt, thread_id, cadence, enabled }`, with `enabled` defaulting to `true` during deserialization.
- Produces: `new_record(id, input, now)`, `updated_record(previous, input, now)`, and `apply_run_result(current, started_at, result)` pure domain operations.
- Produces: `next_run_after(cadence, now)` using explicit IANA timezone or host local time for legacy `None`.

- [ ] **Step 1: Add failing scheduler tests**

Add tests named:

- `calculates_recurring_runs_in_declared_timezone`
- `handles_ambiguous_and_missing_daylight_saving_times`
- `loads_legacy_recurring_records_without_timezone`
- `creates_and_updates_enabled_state_atomically`
- `merges_run_results_without_reverting_configuration`

Assert Tokyo `09:00` becomes `00:00Z`, New York DST gap `02:30` advances to `03:00`, the first fall-back occurrence is chosen, legacy JSON decodes, and updates preserve `last_run` while applying `enabled`.

- [ ] **Step 2: Run scheduler tests and verify failure**

Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml scheduler::tests -- --nocapture`
Expected: FAIL because timezone fields and transition helpers do not exist.

- [ ] **Step 3: Add `chrono-tz` and implement timezone resolution**

Implement `next_run_after` with `chrono_tz::Tz` for declared zones and `chrono::Local` for legacy records. Resolve `LocalResult::Ambiguous` to the earliest UTC instant and probe forward minute-by-minute for `LocalResult::None`, bounded to 180 minutes.

- [ ] **Step 4: Implement atomic input and run-result transitions**

Implement exact functions:

```rust
pub fn updated_record(previous: &ScheduleRecord, input: ScheduleInput, now: DateTime<Utc>) -> Result<ScheduleRecord, String>;
pub fn apply_run_result(current: &ScheduleRecord, started_at: DateTime<Utc>, result: Result<Option<String>, String>) -> ScheduleRecord;
```

Only run-owned fields may change in `apply_run_result`.

- [ ] **Step 5: Run scheduler tests and full Rust tests**

Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml scheduler::tests -- --nocapture`
Expected: PASS.

Run: `make rust-test`
Expected: all Rust tests PASS.

- [ ] **Step 6: Commit the schedule domain**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/scheduler.rs
git commit -m "refactor: correct schedule domain transitions"
```

### Task 2: Schedule service orchestration without long-held locks

**Files:**
- Create: `src-tauri/src/schedule_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/schedule_commands.rs`

**Interfaces:**
- Consumes: Task 1 schedule types and transition helpers.
- Produces: `ScheduleState` containing the schedule mutex.
- Produces: public Tauri commands `schedule_list`, `schedule_create`, `schedule_update`, `schedule_set_enabled`, `schedule_delete`, `schedule_run_now` and `run_due_schedules`.
- Produces: internal `run_schedule_with` orchestration that accepts a dispatch future for tests.

- [ ] **Step 1: Add failing orchestration tests**

Add tests named:

- `dispatch_runs_without_holding_schedule_lock`
- `finalization_preserves_an_edit_made_during_dispatch`
- `finalization_does_not_recreate_a_deleted_schedule`
- `manual_and_due_runs_apply_the_same_transition`

Use a temporary schedule file and a controlled dispatch future that edits or deletes the record before returning.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml schedule_commands::tests -- --nocapture`
Expected: FAIL because `schedule_commands` and `run_schedule_with` do not exist.

- [ ] **Step 3: Extract schedule commands and three-phase orchestration**

Move schedule command code from `lib.rs`. Load/snapshot under the mutex, release it before dispatch, then reacquire/reload/merge/save. Make create/update persist `enabled` in one save.

- [ ] **Step 4: Run focused and full Rust tests**

Run: `cargo test --locked --manifest-path src-tauri/Cargo.toml schedule_commands::tests -- --nocapture`
Expected: PASS.

Run: `make rust-test`
Expected: all Rust tests PASS.

- [ ] **Step 5: Commit schedule orchestration**

```bash
git add src-tauri/src/lib.rs src-tauri/src/schedule_commands.rs
git commit -m "refactor: isolate schedule command orchestration"
```

### Task 3: Split the Tauri composition root

**Files:**
- Create: `src-tauri/src/app_server.rs`
- Create: `src-tauri/src/desktop.rs`
- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/src/worktree_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Move tests from: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Task 2 `schedule_commands` registrations and setup entrypoint.
- Produces: `app_server::AppServerState`, connection commands, and `request_handle`.
- Produces: `desktop` product identity, home, image/browser commands, and runtime package selection.
- Produces: `error::{CommandResult, DesktopAppServerError, DesktopAppServerErrorKind, command_error}`.
- Produces: worktree Tauri command adapters.
- Leaves `lib.rs::run()` as the composition root and `run_example_provider_host()` as the binary-facing provider entrypoint.

- [ ] **Step 1: Move existing contract tests with their owning modules**

Move tests without changing assertions. Add `lib_rs_is_only_a_composition_root` as a source-level guard in `scripts/test_rust_module_boundaries.py` asserting `lib.rs` stays below 220 lines and does not define Tauri command functions.

- [ ] **Step 2: Run tests and verify the new boundary guard fails**

Run: `python3 -m unittest scripts/test_rust_module_boundaries.py -v`
Expected: FAIL because `lib.rs` still owns commands and exceeds the limit.

- [ ] **Step 3: Extract error, desktop, App Server, and worktree command modules**

Use `pub(crate)` only for cross-module interfaces. Preserve command names and serialized contracts. Register module-qualified commands in `tauri::generate_handler!`.

- [ ] **Step 4: Run boundary, Rust, and frontend type tests**

Run: `python3 -m unittest scripts/test_rust_module_boundaries.py -v`
Expected: PASS.

Run: `make rust-test`
Expected: all Rust tests PASS.

Run: `make typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the Rust module split**

```bash
git add src-tauri/src scripts/test_rust_module_boundaries.py
git commit -m "refactor: split Tauri command modules"
```

### Task 4: Bound event deduplication memory

**Files:**
- Modify: `src/app-server/event-reducer.ts`
- Modify: `src/app-server/event-reducer.test.ts`

**Interfaces:**
- Produces: `EventState.seenEventIds` containing exactly the identities represented by the bounded history window.
- Preserves: `reduceAppServerEvent(state, event): EventState` and all consumer-facing event state fields.

- [ ] **Step 1: Add failing reducer boundary tests**

Add tests named:

- `bounds_seen_event_ids_to_the_history_capacity`
- `accepts_an_identity_again_after_it_leaves_the_deduplication_window`

Assert both `history.length` and `seenEventIds.size` are 200 after 201 unique events, and replay of the oldest event is accepted.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run src/app-server/event-reducer.test.ts`
Expected: FAIL because `seenEventIds.size` is 201 and the oldest identity remains suppressed.

- [ ] **Step 3: Rebuild the identity set from bounded history**

After appending and slicing history, derive `seenEventIds` from `history.map(entry => entry.id)` so both windows have identical membership.

- [ ] **Step 4: Run focused and frontend tests**

Run: `pnpm vitest run src/app-server/event-reducer.test.ts`
Expected: PASS.

Run: `make check-tests`
Expected: PASS.

- [ ] **Step 5: Commit event-store bounding**

```bash
git add src/app-server/event-reducer.ts src/app-server/event-reducer.test.ts
git commit -m "refactor: bound event deduplication state"
```

### Task 5: Split schedule form and presentation components

**Files:**
- Create: `src/pages/schedules/schedule-form.ts`
- Create: `src/pages/schedules/schedule-form.test.ts`
- Create: `src/pages/schedules/ScheduleEditorDialog.tsx`
- Create: `src/pages/schedules/ScheduleActionDialog.tsx`
- Create: `src/pages/schedules/ScheduleCard.tsx`
- Create: `src/pages/schedules/schedule-format.ts`
- Modify: `src/pages/SchedulesPage.tsx`
- Modify: `src/pages/SchedulesPage.test.tsx`
- Modify: `src/platform/schedules.ts`
- Modify: `src/app-server/hooks/useSchedules.ts`

**Interfaces:**
- Consumes: Task 1 atomic `ScheduleInput` with recurring `timeZone` and `enabled`.
- Produces: `ScheduleFormState`, `createScheduleFormState(record?)`, `scheduleFormReducer(state, action)`, and `scheduleInputFromForm(state, timeZone)`.
- Produces: focused editor, action, and card components with callback props; `SchedulesPage` retains mutation orchestration.

- [ ] **Step 1: Add failing pure form-model tests**

Test default/create/edit state, daily/weekly/once conversion, invalid once timestamps, trimming, `enabled`, and browser timezone propagation.

- [ ] **Step 2: Run form tests and verify failure**

Run: `pnpm vitest run src/pages/schedules/schedule-form.test.ts`
Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the pure form model and atomic platform types**

Use a discriminated action union. Return `{ ok: true, input } | { ok: false, message }` from `scheduleInputFromForm`. Remove the chained `setEnabled` save from the page.

- [ ] **Step 4: Run form and existing schedule-page tests**

Run: `pnpm vitest run src/pages/schedules/schedule-form.test.ts src/pages/SchedulesPage.test.tsx`
Expected: PASS after updating expectations to one create/update mutation containing `enabled` and `timeZone`.

- [ ] **Step 5: Extract editor, confirmation, card, and format modules**

Keep `SchedulesPage` responsible only for query data, open/close state, mutation selection, and composing children. Keep the page below 220 lines.

- [ ] **Step 6: Run frontend verification**

Run: `make check-tests`
Expected: PASS.

- [ ] **Step 7: Commit the schedule UI split**

```bash
git add src/pages/SchedulesPage.tsx src/pages/SchedulesPage.test.tsx src/pages/schedules src/platform/schedules.ts src/app-server/hooks/useSchedules.ts
git commit -m "refactor: split schedule editor components"
```

### Task 6: Split sidebar panels and centralize navigation metadata

**Files:**
- Create: `src/components/sidebar/navigation.ts`
- Create: `src/components/sidebar/navigation.test.ts`
- Create: `src/components/sidebar/SidebarHeader.tsx`
- Create: `src/components/sidebar/HomeSidebar.tsx`
- Create: `src/components/sidebar/ProjectsSidebar.tsx`
- Create: `src/components/sidebar/PluginsSidebar.tsx`
- Create: `src/components/sidebar/SettingsSidebar.tsx`
- Create: `src/components/sidebar/RouteSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Produces: `SidebarPanel`, `SIDEBAR_PANELS`, and `sidebarPanelForPath(pathname)` from `navigation.ts`.
- Produces: one component per context panel; `ProjectSidebar` owns only rail rendering and panel selection.

- [ ] **Step 1: Add failing navigation mapping tests**

Use table cases for `/`, `/projects`, `/projects/p1`, `/capabilities`, `/schedules`, `/settings`, `/settings/appearance`, `/settings/account`, and an unknown path.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run src/components/sidebar/navigation.test.ts`
Expected: FAIL because the shared navigation module does not exist.

- [ ] **Step 3: Implement shared metadata and use it from `AppLayout`**

Remove the local `sidebarPanelForPath` implementation from `AppLayout`.

- [ ] **Step 4: Extract context panel components**

Move components without changing visible output, query parameters, or accessibility labels. Keep `ProjectSidebar.tsx` below 220 lines.

- [ ] **Step 5: Run sidebar and full frontend tests**

Run: `pnpm vitest run src/components/sidebar/navigation.test.ts src/components/sidebar/ProjectSidebar.test.tsx src/components/layout/AppLayout.test.tsx`
Expected: PASS.

Run: `make check-tests`
Expected: PASS.

- [ ] **Step 6: Commit the sidebar split**

```bash
git add src/components/sidebar src/components/layout/AppLayout.tsx
git commit -m "refactor: split sidebar navigation panels"
```

### Task 7: Centralize settings metadata and remove redundant invalidation

**Files:**
- Modify: `src/app/ui-preferences.ts`
- Modify: `src/app/ui-preferences.test.ts`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/components/settings/SettingsLayout.test.tsx`
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`

**Interfaces:**
- Produces: `UI_NOTIFICATION_SOUND_OPTIONS` as readonly `{ value: UiNotificationSound; label: string }[]` and derives accepted values from it.
- Produces: `SettingsPanel` with explicit optional `icon: SettingsPanelIcon` instead of title lookup.
- Preserves: public thread mutation hook signatures.

- [ ] **Step 1: Add failing metadata and invalidation tests**

Assert every sound option parses and renders once, a renamed title retains an explicitly supplied icon, and `invalidateThreadData` issues one invalidation for the thread prefix plus one for the thread-list prefix.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run src/app/ui-preferences.test.ts src/components/settings/SettingsLayout.test.tsx src/app-server/hooks/useThreadMutations.test.tsx`
Expected: FAIL on missing option metadata/explicit icon behavior and duplicate thread invalidation.

- [ ] **Step 3: Implement metadata and query cleanup**

Derive `UI_NOTIFICATION_SOUNDS` from option metadata, pass icons explicitly from each card, and delete the raw duplicate `['app-server', 'thread', threadId]` invalidation.

- [ ] **Step 4: Run focused and full frontend tests**

Run: `pnpm vitest run src/app/ui-preferences.test.ts src/components/settings/SettingsLayout.test.tsx src/app-server/hooks/useThreadMutations.test.tsx`
Expected: PASS.

Run: `make check-tests`
Expected: PASS.

- [ ] **Step 5: Commit settings and query cleanup**

```bash
git add src/app/ui-preferences.ts src/app/ui-preferences.test.ts src/components/settings/SettingsCards.tsx src/components/settings/SettingsLayout.test.tsx src/app-server/hooks/useThreadMutations.ts src/app-server/hooks/useThreadMutations.test.tsx
git commit -m "refactor: centralize settings metadata"
```

### Task 8: Remove stale Rust validation and complete integration verification

**Files:**
- Modify: `src-tauri/src/platform.rs`
- Modify as required by verification: files changed in Tasks 1-7 only

**Interfaces:**
- Removes: Rust `DeepLinkTarget`, `normalize_deep_link`, `valid_id`, and `validate_schedule` that have no production callers.
- Preserves: active URL, path, image, remote endpoint, and worktree validation.

- [ ] **Step 1: Remove stale code and its self-only tests**

Confirm with `rg` that production callers do not exist before deleting the symbols and the two tests that only exercise them.

- [ ] **Step 2: Run Rust tests and require no project dead-code warnings**

Run: `make rust-test`
Expected: PASS without dead-code warnings from `src-tauri/src/platform.rs`.

- [ ] **Step 3: Run complete verification**

Run in order:

```bash
make format-check
make check-tests
make package-test
make rust-test
make build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Inspect the complete refactor diff and commit cleanup**

Verify no generated protocol changes, no untracked build artifacts, `lib.rs`, `SchedulesPage.tsx`, and `ProjectSidebar.tsx` meet their size boundaries, and every commit is independently intelligible.

```bash
git add src-tauri/src/platform.rs
git commit -m "refactor: remove stale platform validation"
```

- [ ] **Step 5: Re-run post-commit smoke verification**

Run: `make check-tests && make rust-test && git status --short`
Expected: tests PASS and the worktree is clean.
