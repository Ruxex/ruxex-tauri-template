# Command status icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace verbose command execution diagnostics with accessible status icons, clearer success/error colors, and a correctly aligned high-contrast loading indicator.

**Architecture:** Add a focused `ExecutionStatusIcon` component for status and exit-code presentation. Use it in `CommandExecutionView` for the diagnostic row, keeping command output and existing activity-card behavior unchanged. Keep the visible exit-code text only for non-zero values while preserving accessible labels for every icon.

**Tech Stack:** React, TypeScript, Heroicons, DaisyUI/Tailwind utility classes, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-command-status-icons-design.md`

## Global Constraints

- Do not change App Server or command status data models.
- Use existing Heroicons/DaisyUI dependencies; do not add packages.
- Keep visible explanatory text concise; use ARIA labels and titles for icon-only states.
- Run frontend verification through the repository Makefile.

## Review Focus

- A running command must keep a centered, high-contrast spinner: test the fixed flex alignment classes and running status label in `ExecutionStatusIcon`.
- A completed command must not render the old `status completed` text: test the green check icon and absence of the visible status label.
- A zero exit code must not add unnecessary text: test the success icon and absence of `Exit code` text.
- A non-zero exit code must remain actionable: test the red error icon and visible `Exit code: N` text.
- Missing or unknown status values must not crash the command card: test the neutral warning fallback and accessible label.

### Task 1: Define execution status icon behavior with failing tests

**Files:**
- Create: `src/components/conversation/ExecutionStatusIcon.test.tsx`
- Modify: `src/components/conversation/ActivityItem.test.tsx`

**Interfaces:**
- Consumes: the planned `ExecutionStatusIcon` props `{ status?: string; exitCode?: string }`.
- Produces: regression coverage for running, completed, failed/unknown status, zero exit code, and non-zero exit code presentation.

- [ ] **Step 1: Write the failing component tests**

  Add tests that render `ExecutionStatusIcon` with `status="inProgress"`, `status="completed"`, `status="failed"`, `status="unexpected"`, `exitCode="0"`, and `exitCode="1"`. Assert accessible labels, `text-success`/`text-warning`/`text-error`, fixed `inline-flex items-center justify-center` alignment classes, and that only the non-zero exit code exposes visible `Exit code: 1` text. Add an ActivityItem assertion that the command diagnostic row no longer contains the visible `status` and `exit code` label strings.

- [ ] **Step 2: Run the focused tests to verify they fail for the missing behavior**

  Run: `pnpm exec vitest run src/components/conversation/ExecutionStatusIcon.test.tsx src/components/conversation/ActivityItem.test.tsx`

  Expected: FAIL because `ExecutionStatusIcon` does not exist and the current command diagnostics still render text labels.

### Task 2: Implement the shared execution status icons

**Files:**
- Create: `src/components/conversation/ExecutionStatusIcon.tsx`

**Interfaces:**
- Consumes: optional string status and exit code values from command metadata.
- Produces: `ExecutionStatusIcon({ status, exitCode }: { status?: string; exitCode?: string })` rendering icon-only state semantics with accessible labels and the non-zero exit-code text exception.

- [ ] **Step 1: Implement the minimal status mapping**

  Use a fixed `inline-flex size-4 shrink-0 items-center justify-center` wrapper. Map `inProgress`/`running` to a `size-4` high-contrast spinner with `aria-label="Command running"`; `completed` to a green `CheckCircleIcon`; `failed` and unknown non-empty statuses to a yellow `ExclamationTriangleIcon`; and no status to no status icon. Map exit code `0` to a green `CheckCircleIcon` with `aria-label="Command exited successfully"`; map non-zero exit codes to a red `XCircleIcon` plus visible `Exit code: N` text; omit the exit-code indicator when the value is absent.

- [ ] **Step 2: Run the focused tests to verify the implementation passes**

  Run: `pnpm exec vitest run src/components/conversation/ExecutionStatusIcon.test.tsx`

  Expected: PASS with all state mappings, colors, labels, alignment classes, and zero/non-zero text behavior covered.

### Task 3: Replace command diagnostics and verify integration

**Files:**
- Modify: `src/components/conversation/CommandExecutionView.tsx`
- Modify: `src/components/conversation/ActivityItem.test.tsx`
- Modify: `src/components/conversation/CommandExecutionView.stories.tsx`

**Interfaces:**
- Consumes: `ExecutionStatusIcon` from Task 2.
- Produces: command cards whose diagnostic row uses icons instead of visible `status`/`exit code` labels, while preserving command text and result rendering.

- [ ] **Step 1: Update the integration test expectations**

  Replace assertions for visible `status` and `exit code` labels with assertions for the completed status accessible label, successful exit accessible label, and absence of the old visible labels. Add a non-zero command case asserting `Exit code: 1` remains visible and has the error icon.

- [ ] **Step 2: Run the integration tests to verify they fail before the component change**

  Run: `pnpm exec vitest run src/components/conversation/ActivityItem.test.tsx`

  Expected: FAIL because `CommandExecutionView` still renders the old labeled text spans.

- [ ] **Step 3: Replace the diagnostic row implementation**

  Import and render `ExecutionStatusIcon` once in the existing diagnostics row, remove the old visible status/exit-code label spans, keep the row's flex wrapping and border, and update stories so Completed, Running, and Failed demonstrate the new icon semantics.

- [ ] **Step 4: Run focused and full frontend tests**

  Run: `pnpm exec vitest run src/components/conversation/ExecutionStatusIcon.test.tsx src/components/conversation/ActivityItem.test.tsx src/components/conversation/ConversationWorkspace.test.tsx` followed by `make check-tests`.

  Expected: focused tests and the full frontend check pass with no new warnings.

- [ ] **Step 5: Review the final diff and whitespace**

  Run: `git diff --check` and `git diff -- docs/superpowers/specs/2026-11-09-command-status-icons-design.md docs/superpowers/plans/2026-11-09-command-status-icons.md src/components/conversation/ExecutionStatusIcon.tsx src/components/conversation/ExecutionStatusIcon.test.tsx src/components/conversation/CommandExecutionView.tsx src/components/conversation/CommandExecutionView.stories.tsx src/components/conversation/ActivityItem.test.tsx`

  Expected: no whitespace errors and only the approved design, plan, component, story, and test changes are present.
