# Settings Archive and Version Update Design

## Intent

Improve the settings area so users can manage archived chats and see when the
running App Server differs from the daemon-managed Ruxex version.

## Goals

- Add an `Archived chats` settings section at `/settings/archive`.
- List archived chats with cursor-based pagination.
- Allow opening, unarchiving, and permanently deleting archived chats.
- Require confirmation before permanent deletion.
- Render App Server daemon lifecycle controls with the outline button variant.
- Show `Update` beside the App Server version only when the running App Server
  version differs from the daemon-managed Ruxex version.
- Make `Update` execute `stop` followed by `start`.

## Non-goals

- No App Server protocol changes.
- No new daemon protocol action; the existing `stop` and `start` actions are
  composed in the Tauri client.
- No change to the existing top-level archive route behavior beyond sharing the
  improved archive UI.

## Constraints

- Preserve the existing uncommitted preview/read-state work in the checkout.
- Use the existing `thread/list`, `thread/unarchive`, and `thread/delete`
  contracts.
- Use the existing daemon lifecycle command bridge.
- Keep destructive deletion behind an explicit confirmation dialog.

## Approaches

1. Create a settings-only archive implementation. This duplicates the existing
   archive page and risks divergent behavior.
2. Share one archive page implementation between `/archive` and
   `/settings/archive`, add pagination and deletion there, and add only a
   settings navigation entry. This keeps all archive behavior consistent and
   is the selected approach.
3. Add archive management to the App Server settings card. This mixes chat
   data management with runtime controls and does not fit the current settings
   navigation structure.

## Design

### Archived chats

`useArchivedThreadList(cursor)` will include the optional cursor in the stable
query key and pass it to `thread/list` with `archived: true`. The page keeps a
stack of cursors so Next and Previous navigation do not need to interpret opaque
server cursors. The current page is displayed as a simple page number.

The existing mutation layer gains `useDeleteThread`. Both unarchive and delete
invalidate thread list queries. Each row provides Open, Restore, and Delete
actions. Delete opens a confirmation dialog and only calls `thread/delete` after
confirmation.

### App Server version update

The UI compares the connected App Server version from `useAppServerStatus` with
`managedRuxexVersion` from the daemon status. If both are present, differ, and
daemon controls are available, `AppServerCard` shows an `Update` button next to
the displayed version.

The daemon hook exposes an update mutation that calls the existing daemon
control bridge in this exact order:

1. `stop`
2. `start`
3. reconnect/refresh App Server status

The update button is disabled while this sequence is pending. If either step
fails, the error is shown through the existing App Server card error area and
the status is treated as disconnected until a later reconnect succeeds.

### Button styling

Reconnect, Start, Restart, and Stop all use `btn-outline`; semantic colors are
retained for Start, Restart, and Stop.

## Verification

- Unit tests for archived-list cursor parameters and delete mutation mapping.
- Page tests for pagination, open, restore, delete confirmation, and empty/error
  states.
- Settings navigation and breadcrumb tests for the new section.
- App Server card tests for outline controls, version mismatch visibility, and
  update callback behavior.
- Hook tests proving Update invokes stop before start.
- Typecheck, lint, formatting, Rust formatting, and the full Vitest suite.
