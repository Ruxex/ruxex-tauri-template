# Approval, Chat, Theme, and Skills UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated approval content and polish shared chat, theme, Skills, and empty Marketplace UI states.

**Architecture:** Keep protocol and mutation contracts unchanged. Make `ChatListItem` the shared row renderer with optional trailing metadata/actions, simplify permission rendering in `ServerRequestCard`, keep theme preview as a sibling of the selector, and render each `SkillsListEntry` as a collapsible source group.

**Tech Stack:** React, TypeScript, React Testing Library, Vitest, Tailwind/DaisyUI, existing App Server hooks and generated protocol types.

**Spec:** `docs/superpowers/specs/2026-11-10-approval-chat-theme-skills-polish-design.md`

## Global Constraints

- Do not change App Server protocol types or mutation payloads.
- Preserve accessible names and keyboard interaction for buttons and skill toggles.
- Use `interface.shortDescription`, then `shortDescription`, then a bounded `description` fallback for Skills.
- Treat groups whose skills are `scope === "system"` as built-in and label them `Default` without showing their path.
- Keep generated homes and screenshots ignored.
- Use TDD: each behavior change starts with a focused failing test.

## Review Focus

- Permission requests with read, write, network, and entry permissions must show each requested access exactly once; `Write` must not be duplicated.
- Chat rows with and without actions must preserve navigation, timestamp title text, and action event isolation.
- Theme selector preview must remain visible while the selector is closed and must not be nested inside its `<summary>`.
- Skills groups with mixed scopes, missing descriptions, pending mutations, and system-only skills must remain distinguishable and usable.
- Empty Marketplace must use the shared empty-state structure and keep its navigation action.

---

### Task 1: Simplify approval request information

**Files:**
- Modify: `src/components/approvals/ServerRequestCard.tsx`
- Test: `src/components/approvals/ServerRequestCard.test.tsx`

**Interfaces:**
- Consumes: existing `PendingServerRequest`, permission response builders, and approval actions.
- Produces: the same `ServerRequestCard` props and resolution payloads with a single permission-access region.

- [ ] **Step 1: Write the failing tests**

  Update the permission request test to assert the reason, network/read/write/entry rows appear once, the generic `Request summary` region is absent, and the `Access details` disclosure is absent. Update the command approval test to assert the generic summary is absent while approval actions and command rendering remain.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `pnpm vitest run src/components/approvals/ServerRequestCard.test.tsx`

  Expected: FAIL because the current component renders `Request summary` and repeats permission details.

- [ ] **Step 3: Implement the minimal rendering change**

  Remove the `buildApprovalScope`/`displayScope` presentation block and remove the permission `details` block. Keep one `Requested access` region, rendering reason and the existing `permissionSummary` entries once. Preserve all decision handlers and disconnected/malformed states.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run: `pnpm vitest run src/components/approvals/ServerRequestCard.test.tsx`

  Expected: PASS.

### Task 2: Unify project and archived chat rows

**Files:**
- Modify: `src/components/chats/ChatListItem.tsx`
- Modify: `src/components/common/ThreadCard.tsx`
- Modify: `src/pages/ProjectHomePage.tsx`
- Modify: `src/pages/ArchivePage.tsx`
- Test: `src/components/chats/ChatListItem.test.tsx`
- Test: `src/pages/ProjectHomePage.test.tsx`
- Test: `src/pages/ArchivePage.test.tsx`

**Interfaces:**
- Consumes: existing thread summaries, archive/unarchive/delete callbacks, and current friendly timestamp formatter.
- Produces: a `ChatListItem` trailing action slot suitable for archive, restore, and delete actions; `ThreadCard` delegates row actions to it.

- [ ] **Step 1: Write the failing tests**

  Add assertions that an updated timestamp is in the row's trailing area rather than the metadata block, that `ThreadCard` can render custom trailing actions, and that ArchivePage and ProjectHomePage expose their existing action labels through the shared row. Keep the current mutation payload assertions.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `pnpm vitest run src/components/chats/ChatListItem.test.tsx src/pages/ProjectHomePage.test.tsx src/pages/ArchivePage.test.tsx`

  Expected: FAIL because `ChatListItem` currently renders update metadata below the title and `ThreadCard` renders archive actions in a separate card-actions row.

- [ ] **Step 3: Implement the shared row API**

  Add an optional `actions?: ReactNode` prop to `ChatListItem`. Render the title/preview/context in the main link column and place `Updated …` plus actions in the trailing column, with the timestamp aligned right. Ensure action buttons stop propagation and do not navigate. Update `ThreadCard` to pass its actions to `ChatListItem` and remove the separate bottom action area. Update ArchivePage to pass restore/delete icon buttons through the same action slot.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run: `pnpm vitest run src/components/chats/ChatListItem.test.tsx src/pages/ProjectHomePage.test.tsx src/pages/ArchivePage.test.tsx`

  Expected: PASS.

### Task 3: Separate selected theme preview from selector

**Files:**
- Modify: `src/components/settings/UiPreferencesCard.tsx`
- Test: `src/pages/AppearancePage.test.tsx`

**Interfaces:**
- Consumes: existing preset selection callback and `ThemePresetPreview` component.
- Produces: the same `UiPreferencesCard` props with a closed selector and independently visible selected preview.

- [ ] **Step 1: Write the failing test**

  Assert the selected preview is not contained within the theme selector `<summary>` and remains visible when the selector is closed. Keep the selector's current selected label and option behavior covered.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/pages/AppearancePage.test.tsx`

  Expected: FAIL because the preview currently lives inside the selector summary.

- [ ] **Step 3: Implement the sibling layout**

  Render the selector control and selected preview as sibling elements in a responsive row; keep the options grid inside `<details>`. Use a natural left-to-right layout with the selector label/control first and the current preview beside it, stacking on narrow widths.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/pages/AppearancePage.test.tsx`

  Expected: PASS.

### Task 4: Improve Skills grouping, descriptions, and toggles

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx`
- Test: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: `SkillsListResponse`, `SkillMetadata`, `useWriteSkillConfig`, and existing skill mutation/error state.
- Produces: collapsible source groups, concise descriptions, and DaisyUI switch controls without changing write payloads.

- [ ] **Step 1: Write the failing tests**

  Add tests for: system-only groups labeled `Default` without their path; non-system groups showing their source directory; groups rendered as collapsible details; `interface.shortDescription` taking priority over legacy/long descriptions; description fallback being line-clamped and titled with the full text; and skill controls using the DaisyUI `toggle` class while remaining `role="switch"`.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because the page currently exposes every `cwd`, renders full descriptions, and uses a raw checkbox input.

- [ ] **Step 3: Implement the Skills presentation**

  Add small local helpers for group labeling and concise description selection. Render each `SkillsListEntry` in a `<details>` group with a summary label; use `Default` only when all skills in that entry are system-scoped. Render skill descriptions with a two-line clamp and full-text `title` when applicable. Add DaisyUI `toggle` classes to the existing switch input and keep pending/error behavior unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: PASS.

### Task 5: Use shared EmptyState for an empty Marketplace

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx`
- Test: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: existing Marketplace empty branch and `EmptyState` component.
- Produces: the same add-marketplace navigation action using shared empty-state markup.

- [ ] **Step 1: Write the failing test**

  Add an empty Marketplace test that asserts the shared empty-state structure/title and `Add plugin marketplace` link, and asserts the old gray explanatory paragraph is not rendered.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because the current branch renders a custom card with the gray paragraph.

- [ ] **Step 3: Replace the branch with `EmptyState`**

  Import an appropriate archive/plugin icon already used by the page and render `EmptyState` with the existing title and `NavLink` action. Do not pass a description.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: PASS.

### Task 6: Full verification and screenshot review

**Files:**
- Modify: none beyond the implementation files above.
- Test: existing repository test/build and fixture workflows.

- [ ] **Step 1: Run the complete Vitest suite**

  Run: `pnpm test`

  Expected: all tests pass.

- [ ] **Step 2: Run typecheck and lint**

  Run: `pnpm typecheck && pnpm lint`

  Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Build the production frontend**

  Run: `pnpm build`

  Expected: exit code 0.

- [ ] **Step 4: Run the complete screenshot workflow**

  Run: `make ui-fixtures`

  Expected: persistent, page, unshot, volatile, and Marketplace fixture specs pass and write ignored screenshots.

- [ ] **Step 5: Refresh the screenshot gallery**

  Restart the existing ignored `.local-dev/screenshot-gallery/server.py` process on port 8765 if it has a stale batch selected, then verify `http://192.168.0.77:8765/` shows the newest complete batch.

- [ ] **Step 6: Review the working tree**

  Run: `git status --short`

  Expected: only intentional source, test, and design/plan documentation changes are tracked; generated homes, screenshots, and `.wdio/` remain ignored or untracked local artifacts.
