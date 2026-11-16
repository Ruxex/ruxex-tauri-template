# Data home paths design

## Intent

Use the Ruxex data home as the path anchor for global Hooks settings and for
new chats that do not belong to a Project.

## Goals and constraints

- Hooks settings inspect hooks configured under the data home, independent of
  the App Server launch directory.
- A Projectless chat gets a dedicated working directory under the data home;
  Project chats keep using the selected Project root.
- Preserve the App Server as the source of truth for thread `cwd`.
- Use the existing Tauri `homeDataDir` status field and existing
  `hooks/list.cwds` protocol field where possible.

## Approaches

- Pass the data home as the Hooks query `cwd` and create a unique directory
  under `homeDataDir/workspaces` before starting a Projectless chat. This
  reuses existing protocol behavior and isolates each chat. **Recommended;
  chosen by default because no preference response arrived.**
- Add a global-only Hooks API and move Projectless directory assignment into
  the App Server. This changes runtime behavior for all `thread/start`
  clients and needs a protocol/runtime change.
- Use one shared work directory under the data home. This is simpler but
  mixes files across unrelated chats.

## Implementation calls

- Generate a unique child path for every Projectless chat and create it before
  `thread/start`; send that path as `cwd`.
- Keep the existing Project root selection behavior unchanged.
- Add focused regression tests for Hooks query parameters and Projectless
  thread `cwd` creation/selection.

## Non-goals

- Migrating existing threads or changing their saved working directories.
- Changing Project chat directory behavior.
