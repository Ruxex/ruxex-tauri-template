# Streamed Agent Message Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Replace temporary streamed assistant output with the completed agent message when providers use different item IDs.

**Architecture:** Keep reconciliation in the existing event reducer, before presentation-layer merging. Same-ID completions use the current update path; different-ID completions replace only the latest same-turn delta-only agent message.

**Tech Stack:** TypeScript, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-streamed-agent-message-completion-design.md`

## Global Constraints

- Do not change App Server protocol types or provider behavior.
- Do not change presentation-layer merge rules.
- Scope the replacement to completed `agentMessage` items in the same turn.
- Preserve unrelated item types, turns, and completed items.

## Review Focus

- Different delta/completion IDs must not produce duplicate visible messages; test the replacement count and final text.
- Same-ID completion must retain existing behavior; test the raw completed item update.
- A completion with no prior delta must still be inserted; test the normal insertion path.
- A delta from another turn must not be replaced; test same-turn scoping.

### Task 1: Reconcile completed agent messages with temporary deltas

**Files:**
- Modify: `src/app-server/event-reducer.ts` (`upsertStructuredItem`)
- Modify: `src/app-server/event-reducer.test.ts`

**Interfaces:**
- Consumes: Existing `item/completed` notifications and `LiveConversationItem` state.
- Produces: A single live agent message per completed same-turn stream when IDs differ.

- [ ] **Step 1: Write the failing test**

  Add a reducer test that sends a same-turn `item/agentMessage/delta` with ID
  `delta-item`, then `item/completed` with an `agentMessage` ID
  `completed-item` and full text `Hello world`; assert that the turn contains
  one item, with the completed ID, text, and raw completed item.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/app-server/event-reducer.test.ts -t "replaces a streamed agent message when completion uses a different item ID"`

  Expected: FAIL because the current reducer retains both items.

- [ ] **Step 3: Implement the minimal reducer reconciliation**

  In `upsertStructuredItem`, for a completed `agentMessage` with no same-ID
  match, locate the last item in the same turn whose type is `agentMessage` and
  whose `raw` field is absent, then replace that array entry with the completed
  item's ID/type/raw and full text. Leave all other completion and insertion
  paths unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/app-server/event-reducer.test.ts -t "replaces a streamed agent message when completion uses a different item ID"`

  Expected: PASS.

- [ ] **Step 5: Add edge-case assertions and run the reducer suite**

  Cover same-ID completion, completion without a prior delta, and a delta from
  another turn; run `pnpm vitest run src/app-server/event-reducer.test.ts`.

- [ ] **Step 6: Run frontend verification**

  Run `pnpm typecheck`, `pnpm lint:biome`, and `git diff --check` from
  `ruxex-tauri-template`.
