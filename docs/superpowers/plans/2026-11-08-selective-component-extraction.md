# Selective Component Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the three independent UI pieces identified during the component review without changing behavior.

**Architecture:** Shared form layout lives in `src/components/common`, plugin metadata lives in `src/components/plugins`, and chat-title overflow behavior lives in `src/components/chats`. Each extracted component keeps its own presentation contract and receives data through props.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Ladle.

**Spec:** `docs/superpowers/specs/2026-11-08-selective-component-extraction-design.md`

## Global Constraints

- Preserve existing DOM semantics, classes, labels, and behavior.
- Add a colocated Ladle story for each new component.
- Keep app-server and native boundaries outside the extracted presentational components.

### Task 1: Extract shared form field row

**Files:**

- Create: `src/components/common/FormFieldRow.tsx`
- Create: `src/components/common/FormFieldRow.test.tsx`
- Create: `src/components/common/FormFieldRow.stories.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/pages/MarketplaceSettingsPage.tsx`

- [x] Add a failing test for label/control association and shared layout.
- [x] Implement `FormFieldRow` and replace both local copies.
- [x] Verify the focused test and full typecheck.

### Task 2: Extract plugin information item

**Files:**

- Create: `src/components/plugins/PluginInformationItem.tsx`
- Create: `src/components/plugins/PluginInformationItem.test.tsx`
- Create: `src/components/plugins/PluginInformationItem.stories.tsx`
- Modify: `src/pages/PluginDetailPage.tsx`

- [x] Add a failing test for plain values and external links.
- [x] Implement the component and replace the page-local helper.
- [x] Verify focused tests and parent page tests.

### Task 3: Extract chat title overflow behavior

**Files:**

- Create: `src/components/chats/ChatTitle.tsx`
- Create: `src/components/chats/ChatTitle.test.tsx`
- Create: `src/components/chats/ChatTitle.stories.tsx`
- Modify: `src/components/chats/ChatListItem.tsx`

- [x] Add a failing test for the overflowing title marquee state.
- [x] Move the measurement and hover behavior into `ChatTitle`.
- [x] Verify the focused tests and existing `ChatListItem` tests.

### Task 4: Full verification and integration

- [x] Run catalog coverage, typecheck, lint, full tests, and Ladle build.
- [x] Run `git diff --check` and inspect the final diff for behavior-only extraction.
- [x] Commit and push the extraction changes to `main`.
