# Scheduler Crate Design

## Goal

Extract the schedule engine from the Tauri application into a reusable Cargo
workspace member so the current desktop runtime and a future scheduler daemon
share the same persistence, timing, concurrency, and App Server dispatch
behavior.

## Scope

- Keep one-shot, daily, and weekly schedules.
- Change weekly schedules from one weekday to a non-empty set of weekdays.
- Preserve existing persisted schedules that contain a single `weekday` value.
- Poll for due schedules once per minute in the current Tauri runtime.
- Move App Server request construction and dispatch into the shared crate.
- Keep App Server connection establishment owned by the host runtime.
- Do not add a daemon executable in this change.

The schedule editor keeps its current time-selection granularity. The repository
currently generates 15-minute options; changing that UI granularity is outside
this change.

## Architecture

Add a workspace member at `crates/ruxex-scheduler`. The crate owns the schedule
model, JSON persistence, cadence validation and next-run calculation, in-flight
coordination, due/manual execution orchestration, and the protocol-level
`thread/start`, `thread/resume`, and `turn/start` requests used to dispatch a
prompt.

The Tauri crate remains the integration host. Its commands translate Tauri
arguments and errors, obtain the active `AppServerRequestHandle`, and pass that
handle plus the Desktop Ruxex home path to the shared scheduler. A future daemon
will establish its own App Server connection and invoke the same shared service;
it will not need to duplicate schedule logic or request construction.

## Public crate interface

The exact names may follow Rust conventions, but the shared crate must expose
the following responsibilities:

- `ScheduleCadence`, `ScheduleInput`, `ScheduleRun`, `ScheduleRecord`, and the
  persisted schedule file model.
- `Scheduler` (or equivalent) constructed with the schedule home path and
  owning the in-flight schedule guard.
- CRUD operations that load and save the schedule file.
- `run_now` and `run_due` operations that accept an
  `AppServerRequestHandle` and dispatch schedules through the active App Server.
- Pure timing helpers for `next_run_after` and `next_after_run`, unit-testable
  without Tauri.

The App Server dispatch implementation must live in the shared crate and use
the existing client/protocol crates. It creates a new thread when a schedule
has no `threadId`, resumes an existing thread otherwise, then starts a turn
with the schedule prompt. It returns the newly created thread ID so it can be
stored for subsequent recurring runs.

## Data model and compatibility

The weekly cadence becomes conceptually:

```json
{
  "kind": "weekly",
  "weekdays": [2, 4],
  "hour": 15,
  "minute": 0,
  "timeZone": "Asia/Tokyo"
}
```

Weekday numbers retain the existing Sunday-based convention (`0` through `6`).
Inputs must contain at least one weekday, all values must be in range, and the
stored list must be normalized to sorted, deduplicated values.

For backward compatibility, deserialization accepts the existing scalar
`weekday` field and converts it to a one-element `weekdays` list. New writes use
only `weekdays`.

The next-run calculation selects the earliest future occurrence among all
selected weekdays in the schedule timezone. Daily and one-shot behavior remains
unchanged. A one-shot schedule is disabled after its run, including after a
failed dispatch, while recurring schedules advance to their next occurrence and
retain the last-run result.

## Desktop integration

- Replace the Tauri-owned `scheduler.rs` implementation with imports from
  `ruxex-scheduler`.
- Keep Tauri commands named `schedule_list`, `schedule_create`,
  `schedule_update`, `schedule_set_enabled`, `schedule_delete`, and
  `schedule_run_now`.
- Change the setup loop sleep interval from 30 seconds to 60 seconds.
- Preserve the existing local/remote App Server connection behavior. If there
  is no active connection, dispatch fails and the run result is persisted as a
  failure.
- Keep the Tauri/React bridge JSON shape aligned with the new `weekdays` field.

## UI behavior

For weekly schedules, replace the single weekday selector with a multi-select
control that allows any combination of Sunday through Saturday. The form must
reject submission with no selected weekday and display all selected weekday
names in the cadence summary and schedule card.

The React form state uses an array of weekday strings or numbers rather than a
single `weekday` value. Existing records loaded through the bridge are
normalized by the form model so they can be edited without special-case UI
logic.

## Error handling and concurrency

- A schedule ID can have at most one dispatch in flight.
- Deleting a schedule while dispatch is in progress must not recreate it during
  finalization.
- Missing or malformed schedule files return an error to the host.
- Invalid weekday sets and invalid times are rejected before persistence.
- App Server transport or protocol errors are recorded in `lastRun` and do not
  crash the polling loop.

## Testing and acceptance criteria

- Shared crate tests cover CRUD persistence, single-weekday compatibility,
  multi-weekday validation/normalization, next occurrence selection across
  week boundaries and time zones, one-shot disabling, failed-run retention,
  concurrent-run suppression, and App Server request sequences.
- Tauri tests continue to cover command registration/integration behavior.
- Frontend tests cover multi-weekday form state, payload conversion, editing
  existing records, validation, and rendered labels.
- The one-minute loop is represented by a direct constant or interval that is
  covered by a focused test or code-level assertion.
- `cargo test --workspace`, frontend tests, typecheck, and lint pass before the
  change is considered complete.
