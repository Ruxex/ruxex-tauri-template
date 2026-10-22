# Ruxex Tauri Template Refactoring Design

## Purpose

Refactor the current template without changing its intended product surface. The work must make schedule execution correct and maintainable, reduce responsibility concentration in the Tauri bridge, bound event-store memory, split oversized React components, and remove stale or brittle duplication.

The current committed behavior is the compatibility baseline. User-visible behavior should remain the same except where this design explicitly corrects schedule timezone handling, atomic schedule updates, and long-held schedule locks.

## Constraints

- Keep the existing Tauri, React, TanStack Query, and file-backed schedule architecture.
- Do not add product dependencies solely for file movement or abstraction. A maintained IANA timezone library is permitted because recurring schedule correctness requires it.
- Preserve existing App Server and Tauri command payload shapes unless an atomic schedule update requires an intentional extension.
- Keep schedule data backward-compatible with existing `schedules.json` files.
- Preserve the existing generated protocol snapshot.
- Make each independently testable refactor a separate commit.

## Selected Approach

Use incremental extraction behind existing public boundaries. Introduce focused Rust modules and pure helpers first, then move command handlers and UI state onto them. This avoids a broad rewrite and keeps every commit buildable.

Alternatives considered:

1. A full scheduling subsystem rewrite with a database and job queue. Rejected because it exceeds the template's current needs and would add migration and operational complexity.
2. File splitting without behavior changes. Rejected because it would preserve the timezone mismatch, non-atomic edits, unbounded event deduplication, and lock contention.

## Rust Architecture

### Application composition

`src-tauri/src/lib.rs` becomes the composition root. It registers plugins, state, setup work, commands, and the application runner, but does not contain command implementations.

Focused modules own the remaining responsibilities:

- `app_server.rs`: connection state, endpoint types, connection lifecycle, request forwarding, and App Server event forwarding.
- `desktop.rs`: product identity, desktop home resolution, image reading, browser opening, and runtime-package selection.
- `schedule_commands.rs`: Tauri schedule commands, the periodic runner, and App Server dispatch orchestration.
- `worktree_commands.rs`: Tauri command adapters around the existing worktree domain module.
- `error.rs`: the serializable desktop command error contract shared by command modules.

`scheduler.rs` remains the schedule domain and persistence module. It gains focused operations for creating, updating, claiming, and recording a run so orchestration does not duplicate record-transition logic.

### Schedule model and timezone

Daily and weekly schedule input represents a wall-clock time in an explicit IANA timezone. Existing records without a timezone are interpreted as the system timezone at load/use time, preserving compatibility while correcting the UI/backend mismatch.

The frontend sends the browser-resolved timezone when creating or editing a recurring schedule. One-shot schedules remain RFC 3339 timestamps. The backend calculates the next run in the declared timezone and stores the resulting UTC RFC 3339 instant in `nextRunAt`.

Invalid or unavailable timezone identifiers produce a structured validation error. Daylight-saving transitions use the first valid occurrence of an ambiguous local time; nonexistent local times advance to the next valid minute. This rule is deterministic and covered by domain tests.

### Atomic schedule writes

Schedule create and update inputs include `enabled`. A create or edit is persisted in one command and one atomic file replacement. Existing standalone enable/disable remains for list-card toggles.

The frontend no longer chains create/update and `setEnabled` mutations. A failed save leaves the previous persisted record unchanged.

### Schedule execution and locking

No App Server request runs while the schedule file mutex is held. Execution follows three phases:

1. Lock, load, find the record, and mark or snapshot the run candidate.
2. Unlock and dispatch the App Server requests.
3. Lock again, reload the latest file, merge the result only if the record still exists, and save.

Manual and periodic execution share one result-transition helper. User edits made while a run is in flight are preserved; only `lastRun`, `threadId` when newly created, `nextRunAt`, and one-shot enablement are merged from the run result.

## Frontend Architecture

### Schedule page

Move schedule form conversion and validation into pure functions in a schedule-form model module. Use a single reducer-managed form state rather than independent state variables. Split the page into:

- page orchestration and query/mutation wiring;
- schedule editor dialog;
- action confirmation dialog;
- schedule card/list presentation;
- date, cadence, and timezone formatting helpers.

The editor submits one `ScheduleInput` containing `enabled` and timezone. Existing accessibility labels and visible copy remain stable unless they must clarify timezone behavior.

### Sidebar and route metadata

Split each sidebar context panel into a focused component. Define panel identifiers, labels, icons, and route matching in one navigation metadata module used by both `ProjectSidebar` and `AppLayout`. Router elements remain in `router.tsx`; navigation metadata does not attempt to generate the React Router tree.

### Settings cards

Pass panel icons explicitly instead of resolving them from user-visible title strings. Define notification sound options once as typed value/label metadata and use the same values for parsing and rendering.

## Event Store

Replace the unbounded `seenEventIds` set with a fixed-capacity deduplication window coordinated with event history. The newest 200 event identities are retained; evicted identities may be accepted again, matching the bounded-history model. Pending requests and per-thread live state are not evicted by this change.

The reducer remains pure. Tests cover duplicate suppression inside the window, acceptance after eviction, and the capacity bound.

## Query and Validation Cleanup

- Remove duplicate invalidation of the same thread query prefix.
- Retain explicit typed query/mutation hooks; do not introduce a generic hook factory that obscures generated protocol types.
- Remove Rust deep-link and legacy schedule validators that are only referenced by their own tests. The active TypeScript deep-link validation and `scheduler::validate_input` remain authoritative.
- Keep cross-language validation only where both sides independently enforce a real boundary.

## Error Handling

- Preserve the serialized `DesktopAppServerError` shape.
- Map schedule validation, persistence, connection, transport, server, and decode failures to the existing categories.
- A dispatch failure is recorded in `lastRun` and does not corrupt schedule configuration.
- If a schedule is deleted during dispatch, result finalization is a no-op rather than recreating it.
- UI dialogs remain open on mutation failure and show the existing formatted error message.

## Testing and Verification

Development follows test-driven changes. Add or update tests before each behavioral modification.

Required coverage:

- recurring next-run calculation in non-UTC zones and across daylight-saving boundaries;
- backward-compatible decoding of schedule files without timezone or input `enabled`;
- atomic create/update including `enabled`;
- preservation of concurrent schedule edits during run finalization;
- absence of schedule mutex ownership during App Server dispatch, proven through service-level orchestration tests where practical;
- bounded event deduplication behavior;
- pure schedule form conversion and reducer transitions;
- sidebar route-to-panel mapping from shared metadata;
- explicit settings icons and centralized notification sound options;
- removal of redundant query invalidation and dead Rust validation code.

Each commit runs its focused tests. Final verification runs:

```text
make format-check
make check-tests
make package-test
make rust-test
make build
git diff --check
```

## Commit Structure

1. Preserve the pre-refactor working state.
2. Add the approved design and implementation plan.
3. Refactor and correct the scheduler domain and command orchestration.
4. Split the Rust composition root and command modules.
5. Bound event deduplication.
6. Split the schedule page and form model.
7. Split sidebar panels and centralize navigation metadata.
8. Clean up settings metadata, query invalidation, and dead validation code.
9. Apply any final integration fixes found by full verification.
