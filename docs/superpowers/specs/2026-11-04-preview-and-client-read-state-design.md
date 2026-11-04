# Preview Title and Client-side Read State Design

## Intent

Show a new chat's App Server-provided `preview` in the Tauri UI without
setting a persisted thread name, and add client-side read/unread tracking
without changing the App Server protocol or storage.

## Goals

- Update the active and sidebar chat caches when a thread's `preview` becomes
  available.
- Keep `thread.name` unset; the UI continues to prefer `name`, then `preview`.
- Persist read state locally so it survives application restarts.
- Mark a chat read when its conversation route is opened.
- Show an unread indicator in chat lists when the server's `updatedAt` is newer
  than the locally stored read position.

## Non-goals

- Calling `thread/name/set` or generating semantic titles.
- Adding read-state fields or endpoints to the App Server protocol.
- Synchronizing read state between devices or clients.
- Treating read state as a security or authorization boundary.

## Approach

The App Server already persists the first user message as `preview`. The Tauri
client will refresh the thread metadata after a completed turn and merge the
returned `preview` into React Query's thread metadata, list, and search caches.
The merge must not overwrite an explicitly set `name`.

Read state will be stored in `localStorage` under a versioned Tauri-specific
key as a map from thread ID to the last-read `updatedAt` value. A thread is
unread when its current `updatedAt` is greater than that value. Opening a
conversation records the current thread update position; missing or malformed
stored state falls back to an empty map.

## Alternatives considered

- React Query-only state was rejected because it disappears on restart.
- A Tauri SQLite table was rejected because it adds storage and migration
  complexity for a small UI-only preference.
- Setting the server-side thread name was rejected because the user wants the
  preview displayed without creating a durable custom title.

## Implementation decisions

- Use the existing `turn/completed` event synchronization path to refetch the
  thread metadata and update list/search caches.
- Keep read-state parsing and persistence in a focused module, separate from
  general UI preferences.
- Expose a small React hook/provider for marking a thread read and querying
  unread status from sidebar rows.
- Delete/archive operations remove or ignore stale local read entries without
  affecting App Server data.
