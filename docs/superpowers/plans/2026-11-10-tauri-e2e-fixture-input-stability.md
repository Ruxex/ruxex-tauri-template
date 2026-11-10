# Tauri E2E Fixture Input Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Tauri UI fixture screenshots with 300 ms waits and disable automatic first-character capitalization across the app.

**Architecture:** Keep existing fixture call sites unchanged. Update both fixture screenshot helpers to pause before and after `browser.saveScreenshot`, and set `autocapitalize="none"` on the document root so native inputs and the editable composer inherit it.

**Tech Stack:** TypeScript, WDIO browser API, Vitest, static HTML document configuration.

**Spec:** `docs/superpowers/specs/2026-11-10-tauri-e2e-fixture-input-stability-design.md`

## Global Constraints

- Screenshot pauses are exactly 300 ms immediately before and immediately after saving.
- The input behavior uses one app-wide `autocapitalize="none"` setting rather than per-field duplication.
- No dependencies or fixture call sites are changed.

## Review Focus

- Dummy-home screenshots: both pauses happen around the screenshot call; pin in `fixtures/dummy-home/support.test.ts`.
- Marketplace screenshots: both pauses happen around the screenshot call; pin in `fixtures/marketplace-home/support.test.ts`.
- Native inputs, textareas, and the Milkdown contenteditable editor inherit the document setting; pin the checked-in `index.html` contract in a focused unit test.
- Screenshot helper failures: if saving rejects, the post-save pause is not claimed as a cleanup guarantee; preserve the direct await behavior and verify normal call ordering.

### Task 1: Stabilize dummy-home and marketplace screenshots

**Files:**
- Modify: `fixtures/dummy-home/support.ts:325-329`
- Modify: `fixtures/marketplace-home/support.ts:57-61`
- Modify: `fixtures/dummy-home/support.test.ts`
- Modify: `fixtures/marketplace-home/support.test.ts`

**Interfaces:**
- Consumes: existing global WDIO `browser` object and screenshot helper signatures.
- Produces: unchanged `saveFixtureScreenshot(name: string): Promise<void>` and `saveMarketplaceScreenshot(name: string): Promise<void>` signatures with the required waits.

- [ ] **Step 1: Write the failing tests**

  Add one test per helper. Stub `browser.pause` and `browser.saveScreenshot`, call the helper, assert `pause` receives `300` twice, and assert the first pause is ordered before saving while the second is ordered after saving.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `pnpm vitest run fixtures/dummy-home/support.test.ts fixtures/marketplace-home/support.test.ts`

  Expected: FAIL because each helper currently calls `browser.saveScreenshot` without either pause.

- [ ] **Step 3: Implement the minimal waits**

  In both helpers, keep directory creation and the existing screenshot path unchanged, add `await browser.pause(300)` immediately before `await browser.saveScreenshot(...)`, and add the same pause immediately after it.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run: `pnpm vitest run fixtures/dummy-home/support.test.ts fixtures/marketplace-home/support.test.ts`

  Expected: PASS with the new ordering assertions green.

### Task 2: Disable automatic capitalization globally

**Files:**
- Modify: `index.html:2`
- Create: `src/input-behavior.test.ts`

**Interfaces:**
- Consumes: the browser’s inherited global `autocapitalize` behavior.
- Produces: an application document root with `autocapitalize="none"`, covering native text controls and the contenteditable composer.

- [ ] **Step 1: Write the failing test**

  Add a Vitest contract test that reads the checked-in `index.html` and asserts the `<html>` element declares `autocapitalize="none"`.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/input-behavior.test.ts`

  Expected: FAIL because `index.html` has no `autocapitalize` declaration.

- [ ] **Step 3: Implement the document-root setting**

  Add `autocapitalize="none"` to the existing `<html lang="en" data-theme="corporate">` element without changing other document metadata.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/input-behavior.test.ts`

  Expected: PASS.

### Task 3: Full verification

**Files:**
- Modify: none beyond Tasks 1-2.

- [ ] **Step 1: Run the full unit-test suite**

  Run: `pnpm test`

  Expected: exit 0 with no failed tests.

- [ ] **Step 2: Run typecheck and lint**

  Run: `pnpm check`

  Expected: exit 0 with TypeScript and lint checks passing.

- [ ] **Step 3: Review the diff**

  Run: `git diff --check && git diff -- docs/superpowers/specs/2026-11-10-tauri-e2e-fixture-input-stability-design.md docs/superpowers/plans/2026-11-10-tauri-e2e-fixture-input-stability.md index.html fixtures/dummy-home/support.ts fixtures/dummy-home/support.test.ts fixtures/marketplace-home/support.ts fixtures/marketplace-home/support.test.ts src/input-behavior.test.ts`

  Expected: only the requested design, plan, fixture waits/tests, and document-root capitalization setting are present, with no whitespace errors.
