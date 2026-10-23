# Scheduler Crate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract scheduling and AppServer dispatch into a reusable workspace crate, add multi-weekday schedules, and change desktop polling to one minute.

**Architecture:** Create `crates/ruxex-scheduler` as a workspace member. It owns schedule data, persistence, timing, run coordination, and protocol request dispatch while receiving an already-established `AppServerRequestHandle` from its host. Tauri retains command/error adaptation, connection lifecycle, and the one-minute background task; React adapts the weekly schedule form to an array of weekdays.

**Tech Stack:** Rust 2024, Cargo workspace, Tokio, Chrono/Chrono-TZ, Serde/Serde JSON, `ruxex-app-server-client`, `ruxex-app-server-protocol`, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-scheduler-crate-design.md`

## Global Constraints

- “Move App Server request construction and dispatch into the shared crate.”
- “Keep App Server connection establishment owned by the host runtime.”
- “Poll for due schedules once per minute in the current Tauri runtime.”
- “For backward compatibility, deserialization accepts the existing scalar `weekday` field and converts it to a one-element `weekdays` list.”
- “The schedule editor keeps its current time-selection granularity.”
- “Do not add a daemon executable in this change.”

## Review Focus

- Legacy JSON with scalar `weekday` — crate deserialization test in Task 1.
- Duplicate or empty weekday sets — normalization/validation tests in Task 1.
- Weekly next occurrence across Sunday and timezone boundaries — timing tests in Task 1.
- AppServer unavailable during a due run — failed-run persistence test in Task 2.
- A schedule deleted while dispatch is in flight — finalization test in Task 2.

---

### Task 1: Create the scheduler workspace member and core schedule engine

**Files:**
- Create: `Cargo.toml`
- Create: `crates/ruxex-scheduler/Cargo.toml`
- Create: `crates/ruxex-scheduler/src/lib.rs`
- Create: `crates/ruxex-scheduler/src/lib.test.rs` or inline Rust unit tests
- Modify: `src-tauri/Cargo.toml` to depend on `ruxex-scheduler` and remove duplicated scheduler-only dependencies when no longer needed

**Interfaces:**
- Produces public `ScheduleCadence`, `ScheduleInput`, `ScheduleRun`, `ScheduleRecord`, `ScheduleFile`, `SchedulerState`, `load`, `save`, `new_record`, `updated_record`, `next_run_after`, `next_after_run`, and CRUD/state methods consumed by Tasks 2–3.
- Weekly cadence uses `weekdays: Vec<u8>` with Sunday-based values `0..=6`.

- [ ] **Step 1: Write failing Rust tests** for weekly normalization, empty/out-of-range rejection, legacy scalar `weekday` deserialization, earliest next occurrence across selected weekdays, persistence round-trip, and one-shot/recurring run-result updates.
- [ ] **Step 2: Run the new crate tests** with `cargo test -p ruxex-scheduler`; confirm they fail because the workspace member and APIs do not exist.
- [ ] **Step 3: Add the workspace and implement the crate** by moving the pure logic from `src-tauri/src/scheduler.rs`, adding custom serde compatibility for scalar `weekday`, sorting/deduplicating weekly days, and keeping timezone behavior unchanged.
- [ ] **Step 4: Run `cargo test -p ruxex-scheduler`** and confirm all core tests pass.
- [ ] **Step 5: Commit** with `feat: extract scheduler core crate`.

### Task 2: Move AppServer dispatch and run coordination into the crate

**Files:**
- Modify: `crates/ruxex-scheduler/Cargo.toml`
- Modify: `crates/ruxex-scheduler/src/lib.rs`
- Create or modify: `crates/ruxex-scheduler/src/app_server.rs` if a focused module is useful

**Interfaces:**
- Consumes Task 1’s `ScheduleRecord`, `SchedulerState`, and persistence helpers.
- Produces a `ScheduleDispatcher` trait with an async `dispatch(schedule: ScheduleRecord) -> Result<Option<String>, String>` operation, an `AppServerDispatcher<'a>` implementation constructed from `&'a AppServerRequestHandle`, and `SchedulerState::run_now<D: ScheduleDispatcher>(&self, home: &Path, id: &str, dispatcher: Option<&D>) -> Result<ScheduleRecord, String>` plus `SchedulerState::run_due<D: ScheduleDispatcher>(&self, home: &Path, dispatcher: Option<&D>) -> Result<(), String>`. The concrete dispatcher builds `thread/start` or `thread/resume` followed by `turn/start`.

- [ ] **Step 1: Write failing tests** for the exact request sequence, new-thread ID capture, existing-thread resume, transport/protocol failure recording, duplicate in-flight suppression, and deletion during dispatch.
- [ ] **Step 2: Run the focused crate tests** and confirm they fail because dispatch orchestration is not yet present.
- [ ] **Step 3: Implement the AppServer dispatcher** using `AppServerRequestHandle` and `ClientRequest`; keep request IDs local to the crate and return the created thread ID for persistence. Make unavailable handles represent a failed dispatch so due runs are finalized rather than aborting the polling loop.
- [ ] **Step 4: Run the focused crate tests plus `cargo test -p ruxex-scheduler`** and confirm they pass.
- [ ] **Step 5: Commit** with `feat: add app-server dispatch to scheduler crate`.

### Task 3: Replace Tauri-owned scheduler logic with the shared crate

**Files:**
- Modify: `src-tauri/src/schedule_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Delete or replace: `src-tauri/src/scheduler.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Consumes Task 2’s scheduler state and run methods.
- Preserves Tauri command names `schedule_list`, `schedule_create`, `schedule_update`, `schedule_set_enabled`, `schedule_delete`, and `schedule_run_now`.

- [ ] **Step 1: Write/update failing integration tests** for Tauri command delegation, missing AppServer failure persistence, and the polling interval constant.
- [ ] **Step 2: Run the affected Rust tests** and confirm they fail against the old Tauri-owned implementation or missing new behavior.
- [ ] **Step 3: Thin the Tauri commands** to resolve the Desktop Ruxex home and active AppServer handle, delegate all schedule behavior to `ruxex-scheduler`, preserve error mapping, and set the setup loop interval to exactly 60 seconds.
- [ ] **Step 4: Run `cargo test --workspace`** and `cargo check -p ruxex-desktop`; confirm the desktop integration compiles and tests pass.
- [ ] **Step 5: Commit** with `refactor: use shared scheduler crate in tauri host`.

### Task 4: Add multi-weekday frontend form and bridge support

**Files:**
- Modify: `src/platform/schedules.ts`
- Modify: `src/platform/platform-model.ts` and related tests
- Modify: `src/pages/schedules/schedule-form.ts`
- Modify: `src/pages/schedules/schedule-format.ts`
- Modify: `src/pages/schedules/ScheduleEditorDialog.tsx`
- Modify: `src/pages/schedules/schedule-form.test.ts`
- Modify: `src/pages/SchedulesPage.test.tsx` and/or add focused format/UI tests
- Modify: `src/platform/schedules.test.ts`

**Interfaces:**
- Consumes the Rust bridge shape `weekly: { weekdays: number[], hour, minute, timeZone }`.
- Produces form state with `weekdays: string[]`, toggle actions, non-empty validation, payload conversion, and labels such as `Every Tuesday, Thursday · 15:00`.

- [ ] **Step 1: Write failing frontend tests** for default/edit form state, toggling Tuesday and Thursday, empty-selection rejection, bridge payload conversion, multi-day labels, and rendering all selected weekdays.
- [ ] **Step 2: Run the focused Vitest files** and confirm they fail because the model still exposes one `weekday`.
- [ ] **Step 3: Implement the array-based form state and checkbox/multi-select UI** while leaving time options unchanged.
- [ ] **Step 4: Run the focused tests, then `pnpm test` and `pnpm typecheck`**; fix only regressions caused by this change.
- [ ] **Step 5: Commit** with `feat: support multi-weekday schedules in the ui`.

### Task 5: Full verification and final review

**Files:**
- Modify: any affected formatting or documentation files only if verification identifies a concrete issue.

- [ ] **Step 1: Run the complete verification suite**: `cargo test --workspace`, `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] **Step 2: Inspect the final diff and workspace status**, checking that no Tauri-only scheduler implementation or duplicate dispatch logic remains and that the committed spec/plan are present.
- [ ] **Step 3: Run a final self-review** against every acceptance criterion and record any remaining limitation explicitly.
- [ ] **Step 4: Commit any required verification-only fixes** with a focused message, then rerun the affected command and the complete suite.
