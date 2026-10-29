# High-Priority Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the highest-risk coupling in AppServer startup, query cache invalidation, and chat terminology without changing user-visible behavior beyond the requested wording.

**Architecture:** Keep `api.ts` as a transport-only module. Add one AppServer runtime bootstrap boundary that starts event capture before connecting and owns cleanup at the app boundary. Centralize React Query invalidation in small helpers, then rename the remaining user-facing and frontend-internal task terminology to chat terminology while preserving protocol-generated task names.

**Tech Stack:** React 19, TanStack Query, Tauri 2, TypeScript, Vitest, Biome, ESLint.

**Spec:** The refactor review recorded in the preceding conversation: handle high-priority AppServer lifecycle, query invalidation, and chat terminology issues in that order.

## Global Constraints

- Preserve existing AppServer request/response behavior and Tauri command names.
- Keep protocol-generated `ScheduledTask*` types and scheduler terminology unchanged.
- Preserve existing routes and persisted preference/cache formats.
- Add regression tests before each production change.

## Review Focus

- A first native request must not start before the event listener is ready; test ordering in the runtime bootstrap.
- Mock runtime startup must remain side-effect free; test the mock path separately.
- Thread invalidation must refresh conversation data as well as thread summaries; test mutation success and failure.
- Project and thread list invalidation must not invalidate unrelated resources; test the exact query-key boundaries.
- Chat terminology must change in rendered labels and accessibility names without changing protocol `task` fields; test representative sidebar, list, and timeline labels.

### Task 1: AppServer runtime bootstrap

**Files:**
- Create: `src/app-server/app-server-runtime.ts`
- Test: `src/app-server/app-server-runtime.test.ts`
- Modify: `src/app-server/api.ts`
- Modify: `src/app/providers.tsx`
- Modify: `src/app-server/runtime-queries.ts`
- Modify: `src/app-server/hooks/useAccount.ts`
- Modify: `src/app-server/hooks/useAppServerDaemon.ts`
- Modify: `src/app-server/api-startup.test.ts`

**Interfaces:**
- Produces `ensureAppServerRuntime(): Promise<AppServerStatus>` for all frontend connection entry points.
- Keeps `ensureAppServer(): Promise<AppServerStatus>` as a transport-only wrapper around `ensure_app_server`.

- [x] Write a failing test that asserts event-store startup precedes native `ensure_app_server` and that the mock runtime does not start the event store.
- [x] Run the focused runtime test and confirm the pre-refactor ordering failure.
- [x] Implement the runtime bootstrap and route status queries, login, and reconnect through it; leave provider cleanup as the single lifecycle stop point.
- [x] Run the focused runtime, API, and provider tests and confirm they pass.
- [x] Commit the bootstrap refactor.

### Task 2: Query invalidation boundary

**Files:**
- Create: `src/app-server/query-invalidation.ts`
- Test: `src/app-server/query-invalidation.test.ts`
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useTurns.ts`
- Modify: `src/app-server/hooks/useProjects.ts`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`
- Modify: `src/app-server/hooks/useTurns.test.tsx`
- Modify: `src/app-server/hooks/useProjectsHooks.test.tsx`

**Interfaces:**
- Produces `invalidateThreadQueries(queryClient, threadId)`, `invalidateThreadList(queryClient)`, and `invalidateProjectQueries(queryClient, projectId)`.
- Uses the existing thread-root query key as the explicit invalidation boundary for conversation-scoped data.

- [x] Write failing helper tests for thread detail plus conversation, thread list, project detail plus project lists, and failed mutations.
- [x] Run the focused helper tests and confirm the missing helper/key failure.
- [x] Implement the helpers and replace duplicated mutation invalidation code.
- [x] Run all hook tests and confirm success/failure invalidation behavior remains unchanged.
- [x] Commit the query invalidation refactor.

### Task 3: Chat terminology normalization

**Files:**
- Rename: `src/components/tasks/` to `src/components/chats/` for frontend chat UI modules and tests.
- Rename: `src/pages/NewTaskRedirect.tsx` and its test to `NewChatRedirect`.
- Modify: `src/components/sidebar/HomeSidebar.tsx`
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/components/common/ThreadCard.tsx`
- Modify: `src/pages/ThreadsPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: affected tests and imports.

**Interfaces:**
- Preserve `/chat/*` routes and protocol/thread identifiers.
- Replace frontend names and visible labels such as `New task`, `Search tasks`, `Recent tasks`, `Task status`, and `Task activity` with chat terminology.
- Leave scheduled-task protocol types and scheduler pages unchanged.

- [x] Add or update failing UI assertions for representative chat navigation, search, status, and activity labels.
- [x] Run the focused terminology tests and confirm the old labels fail the new expectations.
- [x] Rename frontend modules and update imports, labels, ARIA names, and test descriptions.
- [x] Run the full frontend test suite and static checks.
- [x] Commit the terminology normalization.

### Final verification

- [x] Run full Vitest, TypeScript, Biome, ESLint, Vite build, and `git diff --check`.
- [x] Review the final diff for accidental protocol or route renames.
- [x] Push only after the user explicitly requests or confirms the push for this refactor batch.
