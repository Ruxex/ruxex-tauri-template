# Chat Turn Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep completed turn responses visible while collapsing intermediate conversation activity under an expandable `Worked for …` summary.

**Architecture:** `ConversationWorkspace` passes authoritative turns into `ChatActivityTimeline`. The timeline groups visible items by `turnId`, positions the live Working indicator after the active user message, and renders completed groups as user items, a closed details summary for intermediate items, and the final assistant message.

**Tech Stack:** React, TypeScript, Tailwind/daisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-chat-turn-summary-design.md`

## Global Constraints

- Preserve existing `ConversationItem`, `ActivityItem`, and `ServerRequestCard` renderers.
- Preserve editing, approval actions, and auto-scroll behavior.
- Keep failed and interrupted turns expanded.
- Use the completed turn duration when available, with existing timestamp fallback.
- Keep the active Working indicator left-aligned and immediately after the active user message.

## Review Focus

- A completed turn with user message, activities, intermediate assistant text, and final assistant text: only the final assistant text remains outside the closed summary; covered in Task 1.
- An active turn with a user message: Working appears after that user message and is left-aligned; covered in Task 1.
- A completed turn with no assistant message or no intermediate items: no content is lost or rendered as an empty summary; covered in Task 1.
- Failed/interrupted turns: diagnostics remain expanded; covered in Task 1.
- Loaded history and live completion: authoritative completed statuses and the live completed payload both produce the same summary behavior; covered in Task 1.

---

### Task 1: Group completed conversation turns in the timeline

**Files:**
- Modify: `src/components/conversation/ChatActivityTimeline.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Test: `src/components/chats/ChatActivityTimeline.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- Consumes: `ConversationViewItem[]`, `v2.Turn[]`, current live execution state, and the existing item callbacks.
- Produces: unchanged item/action behavior plus turn-aware rendering; `ChatActivityTimeline` accepts the authoritative `turns` prop.

- [ ] **Step 1: Write the failing timeline tests**

  Add tests proving that:
  - a running turn renders `Working for 42s` after its user item and the indicator is left-aligned;
  - a completed turn renders the user item and final assistant message outside a closed `details`, while intermediate activity/messages are inside the details summary named `Worked for 4m 2s`;
  - opening the details reveals the intermediate items;
  - completed turns with no intermediate items do not create an empty details block;
  - failed or interrupted turns keep their activities visible outside details.

- [ ] **Step 2: Run the focused timeline tests to verify they fail**

  Run: `pnpm vitest run src/components/chats/ChatActivityTimeline.test.tsx`

  Expected: FAIL because the current indicator is inserted at the turn start and completed items are never grouped into a details summary.

- [ ] **Step 3: Add the turn-aware timeline interface and grouping**

  In `ChatActivityTimeline.tsx`, accept `turns: v2.Turn[]`, group visible items by `turnId`, and add helpers that identify completed groups, the final non-empty `agentMessage`, and intermediate items. Render the existing item components through a shared helper. Use a closed `<details>` with a `<summary>` for completed intermediate items, and place the active Working indicator after the active group's user item. Keep empty-timeline behavior and pending requests unchanged.

- [ ] **Step 4: Pass authoritative turns from the workspace**

  In `ConversationWorkspace.tsx`, pass the loaded `turns` array to `ChatActivityTimeline`, preserving the existing `completedTurn` prop for immediate live duration and terminal error behavior.

- [ ] **Step 5: Run the focused tests to verify they pass**

  Run: `pnpm vitest run src/components/chats/ChatActivityTimeline.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx`

  Expected: PASS with all tests in both files passing.

- [ ] **Step 6: Run the full verification suite**

  Run: `pnpm test && pnpm lint && pnpm typecheck && git diff --check`

  Expected: all commands exit 0.
