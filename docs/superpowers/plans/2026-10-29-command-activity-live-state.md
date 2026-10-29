# Command Activity Live State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep command activity rendering aligned across repeated turns and make loading state belong only to the active live turn.

**Architecture:** The event reducer owns a bounded live window: the current turn's streamed items, plus the completed window until the next turn starts. Conversation merging uses `turnId:itemId` identity and receives the live execution status so a completed turn cannot leave stale spinners. The timeline uses the same composite identity for React reconciliation.

**Tech Stack:** React, TypeScript, Vitest, TanStack Query, Tauri app-server events.

**Spec:** `docs/superpowers/specs/2026-10-29-command-activity-live-state-design.md`

## Global Constraints

- Keep the change limited to the Tauri repository.
- Preserve saved thread history as the source of truth for completed turns.
- Do not modify generated protocol files.
- Use `turnId` plus `itemId` for activity identity.

## Review Focus

- A second turn starts while the first turn's history query is stale: the first command must not remain a live spinner or disappear from the merged list.
- A command completes without a structured completion update: the completed turn must stop showing the running spinner.
- Two turns reuse an item ID: React must not reuse the previous `<details>` DOM state for the new command.
- Multiple live activities exist in one turn: only the in-progress activity should show running state.
- Existing agent-message and activity streaming behavior must remain unchanged.

### Task 1: Scope live reducer state to the active turn

**Files:**
- Modify: `src/app-server/event-reducer.ts`
- Test: `src/app-server/event-reducer.test.ts`

**Interfaces:**
- Consumes: existing `turn/started`, `turn/completed`, `item/started`, `item/completed`, and delta notifications.
- Produces: `ThreadExecutionState.items` containing only the current live window and correct turn/status transitions.

- [ ] **Step 1: Write failing reducer tests** for clearing the previous live window when a new turn starts and retaining the completed window until that next turn.
- [ ] **Step 2: Run the reducer tests** and verify the new tests fail because `turn/started` currently preserves old items.
- [ ] **Step 3: Implement the minimal reducer change** in `turn/started`, preserving existing event ordering and item upsert behavior.
- [ ] **Step 4: Run the reducer tests** and verify they pass.

### Task 2: Make conversation merge status- and identity-aware

**Files:**
- Modify: `src/components/conversation/conversation-model.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Test: `src/components/conversation/ConversationWorkspace.test.tsx`

**Interfaces:**
- Consumes: the reducer's live item window and `ThreadExecutionState.status`.
- Produces: `mergeConversationItems(authoritative, live, liveStatus)` with stable composite identity and no stale running metadata after turn completion.

- [ ] **Step 1: Write failing merge tests** for same item IDs across turns, stale authoritative history, and a completed live status.
- [ ] **Step 2: Run the conversation tests** and verify the new tests fail for duplicate identity or stale `inProgress` metadata.
- [ ] **Step 3: Implement composite identity and live-status normalization** without changing authoritative item formatting.
- [ ] **Step 4: Pass the live thread status from `ConversationWorkspace`** into the merge function.
- [ ] **Step 5: Run the conversation tests** and verify they pass.

### Task 3: Make timeline reconciliation and loading per-item safe

**Files:**
- Modify: `src/components/tasks/TaskActivityTimeline.tsx`
- Test: `src/components/tasks/TaskActivityTimeline.test.tsx`
- Test: `src/components/conversation/ActivityItem.test.tsx`

**Interfaces:**
- Consumes: composite item identity and live status from Tasks 1–2.
- Produces: React keys that cannot collide across turns and timeline busy state that reflects only active live work.

- [ ] **Step 1: Write failing timeline tests** for composite keys and completed live activity not remaining busy.
- [ ] **Step 2: Run the timeline/activity tests** and verify the new tests fail against the current item-ID-only keys and shared status behavior.
- [ ] **Step 3: Implement the composite React key and active-turn loading predicate.**
- [ ] **Step 4: Run the focused UI tests** and verify they pass.

### Task 4: Full verification and review

**Files:**
- Verify: all modified files and tests from Tasks 1–3.

- [ ] **Step 1: Run the focused reducer, conversation, timeline, and activity tests.**
- [ ] **Step 2: Run the full project test suite.**
- [ ] **Step 3: Review the diff for generated-file changes, unrelated changes, and stale loading paths.**
- [ ] **Step 4: Record the verification result and prepare the change for the user's requested commit/push workflow.**

