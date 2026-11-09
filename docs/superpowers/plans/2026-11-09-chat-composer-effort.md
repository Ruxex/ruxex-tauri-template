# Chat Composer and Effort Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make both chat composers submit only with Ctrl+Enter, render Markdown inside a WYSIWYG editing surface, and hide effort text when effort is unavailable.

**Architecture:** Extract the shared Milkdown/Crepe editor so both `Composer` and `NewChatComposer` use the same WYSIWYG Markdown surface and serialized string value. Keep submission mutations and keyboard ownership in the parent composers. Resolve unavailable effort as an empty selection and render the summary conditionally.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Milkdown/Crepe, Ladle.

**Spec:** `docs/superpowers/specs/2026-11-09-chat-composer-effort-design.md`

## Global Constraints

- Enter and Shift+Enter insert newlines; only Ctrl+Enter submits.
- IME composition must not submit from the keyboard shortcut.
- Markdown is rendered in the editable Milkdown surface; there is no Write/Preview toggle, separate preview pane, or shortcut hint.
- The editor emits Markdown text and parents continue to own send/clear/focus behavior.
- No new Markdown dependency or payload format change.
- Unavailable effort renders no effort text and does not fall back to visible `medium`.

## Review Focus

- Ctrl+Enter while composing IME input — must not submit; covered in `Composer.test.tsx` and shortcut helper tests.
- Shift+Enter and plain Enter — must not submit; covered in `Composer.test.tsx` and `NewChatComposer.test.tsx`.
- Markdown list/code/heading content while editing — must be rendered by the Milkdown editing surface; covered in `ComposerMessageInput.test.tsx`.
- Empty composer input — must remain usable with the editor placeholder and no separate preview surface; covered in `ComposerMessageInput.test.tsx`.
- Model with no supported reasoning efforts — must omit effort text and preserve selection values; covered in `ComposerSettings.test.tsx` and `useComposerSelection.test.ts`.

### Task 1: Shared Composer Message Input

**Files:**
- Create: `src/components/conversation/ComposerMessageInput.tsx`
- Test: `src/components/conversation/ComposerMessageInput.test.tsx`
- Dependency: `@milkdown/crepe`, `@milkdown/react`, `@milkdown/kit`

**Interfaces:**
- Consumes: `value`, `onChange`, `disabled`, `placeholder`, optional editor-ready callback, and optional key handler.
- Produces: a labeled contenteditable Milkdown surface that emits Markdown text and renders formatting in place.

- [ ] **Step 1: Write the failing tests**
  - Assert Markdown containing `- first`, a heading, and a fenced code block renders as a list, heading, and fenced-code region in a contenteditable editor.
  - Assert an empty value remains editable with the editor placeholder and no separate preview.
- [ ] **Step 2: Run the focused test and verify it fails**
  - Run `pnpm exec vitest run src/components/conversation/ComposerMessageInput.test.tsx`.
  - Expected: FAIL because the component does not exist.
- [ ] **Step 3: Implement the component**
  - Create a Crepe editor with the current value as its default Markdown, register `markdownUpdated`, and emit the serialized string through `onChange`.
  - Synchronize parent-driven value changes with `replaceAll`, apply readonly state from `disabled`, and expose the actual contenteditable element for focus.
  - Disable toolbar, block editing, images, links, tables, math, and CodeMirror features that are not needed in the compact composer.
- [ ] **Step 4: Run the focused test and verify it passes**
  - Run `pnpm exec vitest run src/components/conversation/ComposerMessageInput.test.tsx`.
  - Expected: all tests pass.

### Task 2: Ctrl+Enter Submission Semantics

**Files:**
- Modify: `src/components/conversation/composer-model.ts`
- Test: `src/components/conversation/composer-model.test.ts`
- Modify: `src/components/conversation/Composer.tsx`
- Test: `src/components/conversation/Composer.test.tsx`
- Modify: `src/components/chat/NewChatComposer.tsx`
- Test: `src/components/chat/NewChatComposer.test.tsx`

**Interfaces:**
- Produces: `isComposerSubmitShortcut(event)` returning true only for Enter with `ctrlKey` and no active IME composition.
- Consumes: the shared `ComposerMessageInput` key-handler/ref contract from Task 1.

- [ ] **Step 1: Write the failing tests**
  - Test the helper for Ctrl+Enter, plain Enter, Shift+Enter, Ctrl+Shift+Enter, and composing Ctrl+Enter.
  - In `Composer`, assert Ctrl+Enter submits and plain/Shift+Enter leave the mutation untouched.
  - In `NewChatComposer`, assert the same behavior for the create-thread flow.
- [ ] **Step 2: Run the focused tests and verify they fail**
  - Run `pnpm exec vitest run src/components/conversation/composer-model.test.ts src/components/conversation/Composer.test.tsx src/components/chat/NewChatComposer.test.tsx`.
  - Expected: failures because the current Composer submits on Shift+Enter and NewChatComposer has no shortcut handler.
- [ ] **Step 3: Implement the shared shortcut and wire both composers**
  - Add `isComposerSubmitShortcut` to `composer-model.ts`.
  - Replace the current Shift+Enter condition in `Composer` with the shared predicate.
  - Pass the corresponding key handler to the shared input in both composers; call `preventDefault()` and `form.requestSubmit()` only for the predicate’s true case.
- [ ] **Step 4: Run the focused tests and verify they pass**
  - Re-run the focused command from Step 2.
  - Expected: all shortcut and submission tests pass.

### Task 3: Unavailable Effort Display

**Files:**
- Modify: `src/components/conversation/useComposerSelection.ts`
- Test: `src/components/conversation/useComposerSelection.test.ts`
- Modify: `src/components/conversation/ComposerSettings.tsx`
- Test: `src/components/conversation/ComposerSettings.test.tsx`
- Modify: `src/components/conversation/ComposerSettings.stories.tsx`

**Interfaces:**
- Produces: an empty effort selection for models whose `supportedReasoningEfforts` is empty.
- Consumes: existing model/effort props and callbacks; no protocol changes.

- [ ] **Step 1: Write the failing tests**
  - Assert `defaultEffortForModel` returns `""` for an undefined model and for a model with no supported efforts.
  - Assert the settings summary omits the separator and effort text when no efforts are available or the selected effort is not supported, while retaining the model label.
- [ ] **Step 2: Run the focused tests and verify they fail**
  - Run `pnpm exec vitest run src/components/conversation/useComposerSelection.test.ts src/components/conversation/ComposerSettings.test.tsx`.
  - Expected: FAIL because the current default and summary display fall back to `medium`.
- [ ] **Step 3: Implement the unavailable state**
  - Return `""` from `defaultEffortForModel` when the effort list is empty.
  - Derive the summary effort label from the selected effort only when an effort is available; omit the separator when it is empty.
  - Add an unavailable-effort Ladle story/example without changing normal effort options.
- [ ] **Step 4: Run the focused tests and verify they pass**
  - Re-run the focused command from Step 2.
  - Expected: all effort tests pass.

### Task 4: Integration Verification

**Files:**
- Modify: `src/components/chat/NewChatComposer.tsx`
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/ComposerMessageInput.tsx`

- [ ] **Step 1: Run formatter, typecheck, and lint**
  - Run `pnpm typecheck && pnpm lint:biome && pnpm lint:react && git diff --check`.
  - Expected: all commands exit successfully.
- [ ] **Step 2: Build Ladle**
  - Run `pnpm ladle:build`.
  - Expected: production build succeeds and includes the updated composer/settings stories.
- [ ] **Step 3: Run the full test suite**
  - Run `make check-tests`.
  - Expected: no new failures; report any pre-existing failures separately rather than modifying unrelated code.
