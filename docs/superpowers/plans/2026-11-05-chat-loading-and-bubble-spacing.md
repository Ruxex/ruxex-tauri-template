# Chat Loading and Bubble Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the conversation loading indicator and make chat bubbles slightly more compact vertically.

**Architecture:** Keep both changes local to the existing conversation components. `ConversationWorkspace` will provide the loading state with a centered full-height flex wrapper, while `ConversationItem` will use smaller existing Tailwind padding utilities.

**Tech Stack:** React 19, TypeScript, Tailwind CSS utilities, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-chat-loading-and-bubble-spacing-design.md`

## Global Constraints

- Preserve existing loading semantics, message content, horizontal spacing, colors, and actions.
- Use the repository Makefile as the supported verification entrypoint.
- Do not modify unrelated user changes or create a worktree.

## Review Focus

- Conversation loading state: it remains accessible as a spinner and is centered in the chat area; test in `ConversationWorkspace.ui.test.tsx`.
- User message bubble: it remains right-aligned and gets `py-1.5`; test in `ConversationItem.test.tsx`.
- Assistant message bubble: it receives the matching vertical compaction without changing its background or alignment; test in `ConversationItem.test.tsx`.

### Task 1: Center conversation loading and compact bubble spacing

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.tsx:166-168`
- Modify: `src/components/conversation/ConversationItem.tsx:101`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Test: `src/components/conversation/ConversationItem.test.tsx`

**Interfaces:**
- Consumes: existing `conversation.isLoading` branch and message item rendering.
- Produces: a centered loading wrapper and reduced `py` utility classes.

- [ ] **Step 1: Add the failing loading-layout test**

In `ConversationWorkspace.ui.test.tsx`, configure the existing conversation mock with `isLoading: true` and assert the rendered loading wrapper contains `flex`, `min-h-full`, `items-center`, and `justify-center`, while the spinner retains `loading-spinner` and `loading-lg`.

- [ ] **Step 2: Run the focused loading test and verify it fails**

Run: `pnpm exec vitest run src/components/conversation/ConversationWorkspace.ui.test.tsx -t "centers the conversation loading indicator"`

Expected: FAIL because the current loading branch returns only the spinner without the centered wrapper.

- [ ] **Step 3: Add the failing bubble-spacing assertions**

In `ConversationItem.test.tsx`, change the user bubble assertion from `py-2` to `py-1.5`, and add an assistant-message assertion that its message surface contains `py-2` and not `py-3`.

- [ ] **Step 4: Run the focused bubble tests and verify they fail**

Run: `pnpm exec vitest run src/components/conversation/ConversationItem.test.tsx -t "renders user messages|renders an empty streaming item"`

Expected: FAIL because the current classes are `py-2` for user messages and `py-3` for assistant messages.

- [ ] **Step 5: Implement the minimal UI changes**

Wrap the existing loading spinner in a `div` with `flex min-h-full items-center justify-center`. Change the user bubble class to `py-1.5` and the assistant bubble class to `py-2`; keep all other classes unchanged.

- [ ] **Step 6: Run the focused tests and verify they pass**

Run: `pnpm exec vitest run src/components/conversation/ConversationWorkspace.ui.test.tsx src/components/conversation/ConversationItem.test.tsx`

Expected: PASS with no test failures.

- [ ] **Step 7: Run the frontend verification suite**

Run: `make check-tests`

Expected: the repository's frontend tests and checks pass.

- [ ] **Step 8: Inspect the final diff**

Run: `git diff --check && git diff -- src/components/conversation/ConversationWorkspace.tsx src/components/conversation/ConversationItem.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx src/components/conversation/ConversationItem.test.tsx`

Expected: no whitespace errors and only the requested UI/test changes are present.
