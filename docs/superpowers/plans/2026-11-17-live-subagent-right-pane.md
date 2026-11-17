# Live Subagent Right Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open subagent conversations as live global right-pane tabs and allow descendant approval requests to be answered from either the parent timeline or subagent tab.

**Architecture:** Add a subagent tab kind to `AppLayout`, route click intent through the outlet context, and render a focused timeline viewer that merges persisted history with the shared live event store. Filter the parent's pending requests to include all descendant thread IDs; both views resolve the same request IDs through the existing API.

**Tech Stack:** React, TypeScript, TanStack Query, existing app-server event store and timeline components.

**Spec:** `docs/superpowers/specs/2026-11-17-live-subagent-right-pane-design.md`

## Global Constraints

- Keep existing Git diff and terminal tab behavior.
- A subagent tab is read-only except for existing pending request actions.
- Opening a tab must not create another subagent run.
- Do not run or add tests unless the user asks; run type/lint, catalog, and diff checks.

## Review Focus

- A new child thread started while the parent is open appears in the summary and can be opened.
- Clicking an already open child selects its tab instead of duplicating it.
- Active child events update the right-pane transcript.
- Resolving the same request from either surface removes it from both after the server event.
- Closing and switching tabs preserve existing right-pane behavior.

### Task 1: Route subagent tabs through the global right pane

**Files:** `src/app/app-outlet-context.ts`, `src/pages/ThreadPage.tsx`, `src/components/conversation/ConversationWorkspace.tsx`, `src/components/thread-summary/ThreadSummaryPanel.tsx`, `src/components/layout/AppLayout.tsx`.

- [x] Add an `openSubagentChat({ threadId, label })` outlet callback.
- [x] Add a stable `subagent:<threadId>` tab ID and dedupe repeated opens.
- [x] Render the subagent tab label and content while preserving other tab kinds.
- [x] Replace summary identicons with the localized parenthesized count; make rows open the matching tab.

### Task 2: Render live subagent conversation and approvals

**Files:** `src/components/thread-summary/SubagentConversationPane.tsx`, `src/components/layout/AppLayout.tsx`.

- [x] Load the thread's persisted turns and items, retain its event state, and merge live items with history.
- [x] Render the shared `ChatActivityTimeline` with requests filtered to the tab's thread ID.
- [x] Resolve and reject requests with the existing app-server request functions; omit the composer.

### Task 3: Surface descendant requests in the parent timeline

**Files:** `src/components/conversation/ConversationWorkspace.tsx`, `src/app-server/query-invalidation.ts`, `src/app-server/event-query-sync.ts`, `src/app-server/query-keys.ts`.

- [x] Combine requests for the current parent thread with requests for IDs in its descendant thread list.
- [x] Keep the existing resolve/reject callbacks so either surface can answer the same request.

### Task 4: Verify the implementation

- [x] Run `pnpm check`, `pnpm check:i18n`, and `git diff --check`.
- [x] Run `pnpm build`.
- [x] Do not run tests unless the user asks.
