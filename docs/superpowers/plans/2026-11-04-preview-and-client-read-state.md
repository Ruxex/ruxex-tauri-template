# Preview Title and Client-side Read State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reflect App Server thread previews in the Tauri UI without setting thread names, and persist client-side chat read state with unread indicators.

**Architecture:** On `turn/completed`, the Tauri event synchronizer fetches `thread/read` and merges only the returned thread metadata into active metadata, list, and search caches. A focused React context backed by versioned `localStorage` stores `threadId -> lastReadUpdatedAt`; the conversation layout marks the active thread read and sidebar rows derive unread state from the stored cursor.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, Testing Library, browser `localStorage`.

**Spec:** `docs/superpowers/specs/2026-11-04-preview-and-client-read-state-design.md`

## Global Constraints

- Do not call `thread/name/set`.
- Do not modify the App Server protocol, core repository, or server-side storage.
- Do not add dependencies.
- Preserve an explicit `thread.name`; only fill/update `preview` in UI caches.
- Read state is local to this Tauri client and is not an authorization boundary.

## Review Focus

- A completed turn must update both the current navigation title and every relevant sidebar/search cache from `preview`.
- An explicit `name` must not be replaced by `preview` synchronization.
- Three concurrent conversation queries must not cause three preview fetches or three resume calls.
- Malformed or old read-state storage must safely fall back to no unread entries.
- Opening a chat must mark it read and rerender the sidebar without requiring navigation away.

### Task 1: Add local thread read-state storage and provider

**Files:**
- Create: `src/app/thread-read-state.ts`
- Create: `src/app/thread-read-state.test.tsx`
- Modify: `src/app/providers.tsx`
- Test: `src/app/providers.test.tsx`

**Interfaces:**
- Produces `THREAD_READ_STATE_KEY`, `parseThreadReadState`, `readThreadReadState`, `writeThreadReadState`.
- Produces `ThreadReadStateProvider` and `useThreadReadState()` with `markThreadRead(threadId, updatedAt)`, `isThreadUnread(threadId, updatedAt)`, and `readAtByThreadId`.

- [ ] **Step 1: Write failing storage tests**

  Cover defaults, malformed/version-mismatched JSON, valid timestamps, persistence, and marking a thread at a newer or older update position.

- [ ] **Step 2: Run the focused tests and verify they fail for the missing read-state module/provider**

  Run: `pnpm exec vitest run src/app/thread-read-state.test.tsx`

- [ ] **Step 3: Implement the versioned localStorage module and provider**

  Keep the stored shape `{ version: 1, readAtByThreadId: Record<string, number> }`; ignore invalid entries and never move a cursor backwards. The provider should update React state synchronously and persist through an effect.

- [ ] **Step 4: Add the provider to `AppProviders` and update provider lifecycle coverage**

  Wrap the router with `ThreadReadStateProvider` next to `UiPreferencesProvider`; keep existing StrictMode event-store behavior unchanged.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `pnpm exec vitest run src/app/thread-read-state.test.tsx src/app/providers.test.tsx`

### Task 2: Synchronize completed-turn previews into UI caches

**Files:**
- Modify: `src/app-server/event-query-sync.ts`
- Modify: `src/app-server/event-query-sync.test.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts` only if a shared metadata fetch helper is needed

**Interfaces:**
- Consumes `turn/completed` notifications and `thread/read` responses.
- Produces cache updates for metadata, thread lists, and search results without changing `name`.

- [ ] **Step 1: Write a failing event-sync test**

  Mock `requestAppServerMethod` and assert that a `turn/completed` event reads the thread and applies its returned `preview` to metadata/list/search caches while preserving an existing explicit name.

- [ ] **Step 2: Run the focused event-sync test and verify it fails**

  Run: `pnpm exec vitest run src/app-server/event-query-sync.test.ts`

- [ ] **Step 3: Implement the minimal completed-turn preview refresh**

  Make synchronization awaitable or otherwise testable, call `thread/read` directly from the completed-turn path, and merge the returned `preview`/`updatedAt`/other non-name metadata into matching caches. Do not invalidate the conversation in a way that causes an extra `thread/resume`; use the existing in-flight resume behavior only where required by the current query path.

- [ ] **Step 4: Add the concurrency regression test**

  Verify repeated completed-turn notifications for the same thread do not overwrite a newer cached preview with an older response.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `pnpm exec vitest run src/app-server/event-query-sync.test.ts`

### Task 3: Mark the active conversation read

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/AppLayout.test.tsx`

**Interfaces:**
- Consumes `useThreadReadState()` and the already-loaded `useThread()` result.
- Produces a local read cursor update when `/chat/:threadId` has a thread with a valid `updatedAt`.

- [ ] **Step 1: Write a failing layout test**

  Render a chat route with a thread update timestamp and assert `markThreadRead(threadId, updatedAt)` is called; verify non-chat routes do not mark a thread.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `pnpm exec vitest run src/components/layout/AppLayout.test.tsx`

- [ ] **Step 3: Implement route-aware read marking**

  Mark the selected thread in an effect keyed by route/thread ID and `updatedAt`; do not mark a thread while metadata is unavailable.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run: `pnpm exec vitest run src/components/layout/AppLayout.test.tsx`

### Task 4: Show unread state in all chat lists

**Files:**
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/components/chats/ChatListItem.tsx`
- Modify: `src/components/chats/ChatListItem.test.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx` if shared sidebar coverage needs updated provider setup

**Interfaces:**
- Consumes `isThreadUnread(thread.id, thread.updatedAt)` from the read-state provider.
- Produces an accessible, non-text unread dot in `ChatListItem` for recent and project chat lists.

- [ ] **Step 1: Write failing component tests**

  Assert the unread indicator appears only for an unread thread and disappears after the read-state hook reports it read; preserve the existing title fallback and status indicator.

- [ ] **Step 2: Run the focused component tests and verify they fail**

  Run: `pnpm exec vitest run src/components/chats/ChatListItem.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

- [ ] **Step 3: Implement unread derivation and rendering**

  Pass an `unread` prop from `ThreadListRow` and render a small filled dot with an accessible label, without changing the visible chat title text.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `pnpm exec vitest run src/components/chats/ChatListItem.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

### Task 5: Full verification and cleanup

**Files:**
- Modify: any files required by formatter/linter/test corrections only.

- [ ] **Step 1: Run the complete frontend verification suite**

  Run the repository's existing TypeScript, ESLint, Vitest, Rust formatting, and diff checks used by the Tauri template.

- [ ] **Step 2: Review the diff against the design**

  Confirm there is no `thread/name/set`, no protocol/core change, no dependency change, and no accidental server-side read-state behavior.

- [ ] **Step 3: Run the relevant tests once more after formatting**

  Expected: all tests and checks pass with no new warnings.
