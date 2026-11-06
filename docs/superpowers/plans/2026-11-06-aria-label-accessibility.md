# ARIA Label Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit ARIA labels to Ruxex's production UI controls so Codex can locate and operate the real Tauri UI without changing HTML structure or behavior.

**Architecture:** Enforce a source-level ARIA-label contract for production TSX, then add labels to existing controls in the primary app surfaces. Labels are the only UI code change; no semantic elements, routes, styles, handlers, capabilities, or dependencies change.

**Tech Stack:** React/TypeScript, Vitest/Testing Library, Python unittest, WebdriverIO v10 `wdio session`, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-11-06-aria-label-accessibility-design.md`

## Global Constraints

- Do not change HTML structure, CSS, visible copy, event handlers, routing, or provider/API behavior.
- Add `aria-label` to production `button`, `input`, `select`, and `textarea` opening tags.
- Preserve existing ARIA attributes and use dynamic labels where repeated controls need distinct names.
- Do not add test-only Tauri permissions, diagnostics plugins, or global APIs.
- Do not send real provider/API requests; use local dummy-provider state for desktop verification.

## Review Focus

- Icon-only or visually compact controls must name the action, not only the icon.
- Repeated project/chat/plugin controls must include the target name in the label.
- Text inputs and selects with visible labels must still have explicit `aria-label` values.
- Disabled/loading controls must retain a stable label while their visible status changes.
- Modal backdrop/close controls must remain discoverable without adding duplicate behavior.

## File Map

### Files to create

- `scripts/test_accessibility_labels.py` — static contract test for production TSX control labels.
- `docs/superpowers/specs/2026-11-06-aria-label-accessibility-design.md` — approved design constraints.
- `docs/superpowers/plans/2026-11-06-aria-label-accessibility.md` — this execution plan.

### Files to modify

- `src/components/approvals/ServerRequestCard.tsx` — request answer and decision controls.
- `src/components/chats/ChatSearchDialog.tsx`, `src/components/chats/ChatSidebarSections.tsx` — search and chat navigation controls.
- `src/components/conversation/ActivityItem.tsx`, `Composer.tsx`, `ComposerOptions.tsx`, `ConversationItem.tsx`, `SlashCommandPalette.tsx` — conversation and composer controls.
- `src/components/projects/NewProjectDialog.tsx`, `WorktreeCard.tsx` — project/worktree forms.
- `src/components/quick-panel/QuickPanelPage.tsx` — quick panel controls.
- `src/components/settings/SettingsCards.tsx` — settings controls.
- `src/components/sidebar/PluginsSidebar.tsx` — capability navigation.
- `src/pages/AccountPage.tsx`, `ArchivePage.tsx`, `CapabilitiesPage.tsx`, `LoginPage.tsx`, `MarketplaceSettingsPage.tsx`, `McpServersPage.tsx`, `PluginDetailPage.tsx`, `ProjectHomePage.tsx`, `ProjectsPage.tsx`, `ThreadsPage.tsx`, `schedules/ScheduleActionDialog.tsx`, `schedules/ScheduleCard.tsx`, `schedules/ScheduleEditorDialog.tsx` — page and dialog controls.
- `Makefile` — include the static accessibility contract in the supported package test entrypoint if needed by the repository's existing test discovery.

## Implementation Tasks

### Task 1: Add the failing ARIA-label contract test

**Files:**
- Create: `scripts/test_accessibility_labels.py`
- Test: the new unittest itself

**Interfaces:**
- Produces a deterministic check over `src/**/*.tsx`, excluding `*.test.tsx`, for opening `button`, `input`, `select`, and `textarea` tags.

- [ ] **Step 1: Write the failing static test**

  Assert that every production control opening tag contains `aria-label=` and report the file and line for each violation.

- [ ] **Step 2: Run the test and verify it fails for the current code**

  Run: `python3 -m unittest scripts.test_accessibility_labels -v`

  Expected: FAIL with the current unlabeled controls, before any TSX is modified.

### Task 2: Label navigation, authentication, chat, and composer controls

**Files:**
- Modify: `src/pages/LoginPage.tsx`, `src/pages/ThreadsPage.tsx`, `src/components/sidebar/PluginsSidebar.tsx`
- Modify: `src/components/chats/ChatSearchDialog.tsx`, `src/components/chats/ChatSidebarSections.tsx`
- Modify: `src/components/conversation/ActivityItem.tsx`, `Composer.tsx`, `ComposerOptions.tsx`, `ConversationItem.tsx`, `SlashCommandPalette.tsx`

**Interfaces:**
- Consumes existing visible action text and state values.
- Produces stable labels such as `API key`, `Log in`, `Search chats`, `Send`, `Cancel edit`, and dynamic mode/command labels.

- [ ] **Step 1: Add only `aria-label` attributes**
- [ ] **Step 2: Run the static contract and affected component tests**

  Run: `python3 -m unittest scripts.test_accessibility_labels -v` and the relevant Vitest test files.

- [ ] **Step 3: Confirm no visible or behavioral diff beyond labels**

  Inspect the diff and run `git diff --check`.

### Task 3: Label project, settings, capability, approval, and dialog controls

**Files:**
- Modify: `src/components/approvals/ServerRequestCard.tsx`, `src/components/projects/NewProjectDialog.tsx`, `src/components/projects/WorktreeCard.tsx`, `src/components/quick-panel/QuickPanelPage.tsx`, `src/components/settings/SettingsCards.tsx`
- Modify: `src/pages/AccountPage.tsx`, `ArchivePage.tsx`, `CapabilitiesPage.tsx`, `MarketplaceSettingsPage.tsx`, `McpServersPage.tsx`, `PluginDetailPage.tsx`, `ProjectHomePage.tsx`, `ProjectsPage.tsx`, `schedules/ScheduleActionDialog.tsx`, `ScheduleCard.tsx`, `ScheduleEditorDialog.tsx`

**Interfaces:**
- Produces stable names for repeated CRUD, pagination, form, schedule, MCP, project, and approval controls.

- [ ] **Step 1: Add labels to all remaining controls identified by the contract**
- [ ] **Step 2: Run the static contract and affected component/page tests**
- [ ] **Step 3: Run `make check-tests` and confirm the full frontend suite remains green**

### Task 4: Verify the real Tauri interaction loop

**Files:**
- Modify: none unless verification reveals a missing label in a real route

**Interfaces:**
- Consumes the committed labels and existing `wdio.tauri.conf.mjs` session flow.

- [ ] **Step 1: Build the debug binary using the repository-supported command**

  Run: `make e2e-build` or the repository's existing debug build target, without a real provider request.

- [ ] **Step 2: Start `tauri-driver` and open one persistent WDIO session with a temporary HOME and dummy provider**
- [ ] **Step 3: From independent shell commands, snapshot the UI and locate/fill the labeled message input, then locate/click its labeled action**
- [ ] **Step 4: Capture a screenshot and close the session; stop only the owned driver process**
- [ ] **Step 5: Record the observed labels and any environment limitation in the final report**

### Task 5: Full verification and review

**Files:**
- Modify: none

- [ ] **Step 1: Run `make verify`**
- [ ] **Step 2: Run `git diff --check` and inspect the final diff for label-only UI changes**
- [ ] **Step 3: Self-review against the design acceptance criteria**
- [ ] **Step 4: Mark the plan ledger complete and report the exact test results**
