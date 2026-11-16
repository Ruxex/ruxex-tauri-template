# Data Home Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make global Hooks settings inspect the Ruxex data home and give every Projectless chat its own working directory beneath that home.

**Architecture:** Use the App Server status `homeDataDir` to scope `hooks/list` to the data home. Add a Tauri command that atomically creates a unique directory under `<RUXEX_HOME>/workspaces`; the new-chat composer passes its returned path as `thread/start.cwd` only when no Project is selected.

**Tech Stack:** React, TypeScript, Vitest, Tauri commands, Rust.

**Spec:** `docs/superpowers/specs/2026-11-16-data-home-paths-design.md`

## Global Constraints

- Hooks settings inspect hooks configured under the data home, independent of the App Server launch directory.
- A Projectless chat gets a dedicated working directory under the data home; Project chats keep using the selected Project root.
- Preserve the App Server as the source of truth for thread `cwd`.
- Use the existing Tauri `homeDataDir` status field and existing `hooks/list.cwds` protocol field where possible.

## Review Focus

- App Server status may still be loading when Hooks settings mounts; defer the Hooks query until `homeDataDir` is available and ensure the query uses that path.
- Data-home paths may contain spaces or non-ASCII characters; pass the path unchanged through Rust, Tauri, and App Server parameters.
- Concurrent chat starts must not reuse a workspace directory; create child directories atomically and retry name collisions.
- Project-selected chats must keep their existing project root `cwd` without creating a data-home workspace.
- A workspace creation error must prevent starting a thread and surface through the existing submit error behavior.

---

### Task 1: Scope Hooks settings to the data home

**Files:**
- Modify: `src/pages/HooksPage.tsx`
- Test: `src/pages/HooksPage.test.tsx`

**Interfaces:**
- Consume `useAppServerStatus()` and pass `homeDataDir` to `useHooksList({ cwds: [homeDataDir] })` once available.

- [x] **Step 1: Write a failing test**

Add a HooksPage test with App Server status `homeDataDir: "/home/user/.ruxex"` and assert the page requests `useHooksList` with `{ cwds: ["/home/user/.ruxex"] }`.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run src/pages/HooksPage.test.tsx`
Expected: the query hook is called without the data-home `cwds` parameter.

- [x] **Step 3: Implement the Hooks query scope**

Read `homeDataDir` from `useAppServerStatus`; pass it as the sole `cwds` entry to `useHooksList`. Preserve the existing loading and error UI while the status is unavailable.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `pnpm exec vitest run src/pages/HooksPage.test.tsx`
Expected: PASS.

### Task 2: Create unique Projectless chat workspaces

**Files:**
- Modify: `src-tauri/src/app_server.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/app_server.rs`
- Modify: `src/test-support/mock-app-server.ts`
- Test: `src/test-support/mock-app-server.test.ts`
- Create: `src/platform/chat-workspace.ts`

**Interfaces:**
- Produce Tauri command `create_chat_workspace() -> CommandResult<String>` returning an absolute, existing directory under `<RUXEX_HOME>/workspaces`.
- Produce frontend function `createChatWorkspace(): Promise<string>` invoking that command.

- [x] **Step 1: Write failing Rust and Mock App Server tests**

Test that two successive Rust workspace creations return distinct child directories beneath a configured home with spaces and non-ASCII characters, and that each directory exists. Also test that an error creating a workspace is returned to the caller. Test that two Mock App Server workspace requests return distinct paths beneath its data home.

- [x] **Step 2: Run tests to verify they fail**

Run: `make rust-test` and `pnpm exec vitest run src/test-support/mock-app-server.test.ts -t 'creates distinct chat workspaces'`.
Expected: the Rust test does not compile because the workspace creation API is absent, and the Mock App Server test reports an unsupported command.

- [x] **Step 3: Implement atomic directory creation**

Create `<RUXEX_HOME>/workspaces` and atomically create a uniquely named child directory. Retry if a candidate already exists; propagate other filesystem errors as a lifecycle command error. Register the command in `src-tauri/src/lib.rs` and expose it in `src/platform/chat-workspace.ts`. In Mock App Server runtime, route workspace creation to the mock and return sequential unique paths under its `homeDataDir`.

- [x] **Step 4: Run the focused Rust test and verify it passes**

Run: `make rust-test` and `pnpm exec vitest run src/test-support/mock-app-server.test.ts -t 'creates distinct chat workspaces'`.
Expected: both commands PASS.

### Task 3: Pass the workspace to Projectless chat starts

**Files:**
- Modify: `src/components/chat/NewChatComposer.tsx`
- Test: `src/components/chat/NewChatComposer.test.tsx`

**Interfaces:**
- Consume `createChatWorkspace(): Promise<string>` from `src/platform/chat-workspace.ts`.

- [x] **Step 1: Write failing composer tests**

Cover that a Projectless submit passes the created workspace as `thread/start.cwd`, that a Project-selected submit keeps the selected Project root without creating a workspace, and that workspace creation failure prevents `thread/start` and is shown in the composer alert.

- [x] **Step 2: Run the focused composer tests and verify they fail**

Run: `pnpm exec vitest run src/components/chat/NewChatComposer.test.tsx`
Expected: the Projectless start has no workspace `cwd` and the workspace creation function is unused.

- [x] **Step 3: Implement Projectless workspace selection**

Before `thread/start`, call `createChatWorkspace()` only when no Project is selected. Pass its returned path as `cwd`; keep the selected Project root path precedence unchanged. Store workspace creation failures in local submit error state so the existing alert displays them.

- [x] **Step 4: Run the focused composer tests and verify they pass**

Run: `pnpm exec vitest run src/components/chat/NewChatComposer.test.tsx`
Expected: PASS.

### Task 4: Verify the completed change

**Files:** all files above.

- [ ] Run `make check-tests` and confirm the frontend suite passes. **Attempted:** typecheck and lint pass; the full suite has three failures in unrelated, pre-existing modified UI tests.
- [x] Run `make rust-test` and confirm the Tauri Rust suite passes.
- [x] Run `make build` and confirm the frontend production build passes.
- [x] Run `git diff --check` and inspect the final diff, preserving unrelated working-tree changes.
