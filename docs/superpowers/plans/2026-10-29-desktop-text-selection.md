# Desktop Text Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent accidental text selection across the desktop UI while preserving selection in chat content and editable fields.

**Architecture:** Set the app-wide selection default to `none` in the global stylesheet. Add one explicit `selectable-content` class to rendered chat/activity content and a CSS exception for form controls and editable elements. Keep the behavior CSS-driven so future UI components inherit the desktop default automatically.

**Tech Stack:** React 19, TypeScript, Tailwind/DaisyUI, Vitest, Biome, ESLint, Vite.

**Spec:** `docs/superpowers/specs/2026-10-29-desktop-text-selection-design.md`

## Global Constraints

- Normal desktop UI must use `user-select: none`.
- Chat content, activity content, `input`, `textarea`, and editable elements must remain selectable.
- Preserve existing input, copy, keyboard, and Markdown behavior.
- Do not change Tauri/Rust code or add dependencies.

## Review Focus

- Markdown chat text and activity text remain selectable after the global rule is applied.
- Textareas and inputs remain selectable for editing and copying.
- Buttons, navigation labels, and surrounding cards do not become selectable through inherited styles.
- The CSS exception remains scoped to content and editable controls rather than making the whole conversation workspace selectable.

### Task 1: Desktop selection policy

**Files:**
- Modify: `src/styles/index.css`
- Modify: `src/components/conversation/MarkdownContent.tsx`
- Test: `src/components/conversation/MarkdownContent.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- `MarkdownContent` keeps its existing props and adds the `selectable-content` class to its rendered content root.
- Global CSS exposes the `selectable-content` class as the explicit text-selection exception.

- [x] **Step 1: Write failing tests**

  Add assertions that rendered Markdown content and conversation activity content include `selectable-content`, and that the global stylesheet contains the `user-select: none` default plus exceptions for editable controls and `.selectable-content`.

- [x] **Step 2: Run focused tests to verify failure**

  Run:

  ```bash
  /home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/conversation/MarkdownContent.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx
  ```

  Expected: FAIL because the selection class and global CSS policy are not present.

- [x] **Step 3: Implement the selection policy**

  Add the global CSS default and exceptions in `src/styles/index.css`. Add `selectable-content` to the Markdown renderer root; activity content already uses that renderer, so it inherits the same exception without broadening the workspace container.

- [x] **Step 4: Run focused tests to verify success**

  Run the focused Vitest command from Step 2. Expected: PASS.

- [x] **Step 5: Run the full verification suite**

  Run full Vitest, TypeScript, Biome, ESLint, Vite build, and `git diff --check`. Expected: all pass; an existing Vite chunk-size warning is acceptable if no new error appears.

- [x] **Step 6: Commit**

  ```bash
  git add docs/superpowers/specs/2026-10-29-desktop-text-selection-design.md docs/superpowers/plans/2026-10-29-desktop-text-selection.md src/styles/index.css src/components/conversation/MarkdownContent.tsx src/components/conversation/MarkdownContent.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx
  git commit -m "fix(desktop): prevent accidental UI text selection"
  ```

## Self-Review

- The spec's global default, editable-field exception, chat-content exception, and verification requirements are each covered by Task 1.
- No Tauri/Rust or dependency changes are required.
- The activity view uses `MarkdownContent`, so it receives the same explicit content exception without making the entire activity card selectable.
