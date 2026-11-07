# Unshot UI Fixture Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing DummyProvider screenshot run so every currently identified unshot page or interactive component has a reproducible screenshot.

**Architecture:** Keep durable data creation in the existing persistent WDIO suite and add a screen-state suite that reuses the prepared `.d` home. Each screenshot is reached through the real Tauri UI; no database or fixture-home writes are added. The existing `make ui-fixtures` target remains the single complete entry point.

**Tech Stack:** WebdriverIO, TypeScript, Tauri desktop binary, DummyProvider, Make.

**Spec:** `docs/superpowers/specs/2026-11-07-dummy-home-fixture-catalog-design.md`

## Global Constraints

- All durable data is created by the real desktop app through WDIO.
- The persistent home remains the short ignored path `/.d/`.
- The fixture run stays headful for now.
- No screenshots or generated homes are committed.
- Image fallback behavior is out of scope.

## Review Focus

- Each screenshot must wait for a semantic selector so slow App Server startup does not create blank artifacts.
- Screenshots of menus and dialogs must open them through their accessible controls, not by injecting DOM state.
- The screen-state suite must tolerate the existing persistent catalog and leave the home reusable by the volatile suite.
- Re-running the unified target must recreate the same durable data and artifact names without relying on the previous browser process.

### Task 1: Add the unshot screen-state WDIO suite

**Files:**
- Create: `fixtures/dummy-home/unshot.spec.ts`
- Modify: `fixtures/dummy-home/support.ts` only if a small reusable wait/navigation helper is needed

**Interfaces:**
- Consumes: the persistent `.d` home produced by `persistent.spec.ts` and existing fixture helpers.
- Produces: screenshots for login, quick panel, capabilities tabs, completed chat, project/search/composer dialogs, automation states, and MCP add dialog.

- [ ] **Step 1: Add one test that captures direct routes and reachable controls through the real UI.**
- [ ] **Step 2: Run the new spec against the prepared home and fix selectors or timing until it passes.**
- [ ] **Step 3: Confirm the spec leaves the prepared home usable by the volatile suite.**

### Task 2: Make the unified target include the new suite

**Files:**
- Modify: `Makefile`
- Modify: `README.md`

**Interfaces:**
- Consumes: `fixtures/dummy-home/unshot.spec.ts`.
- Produces: one documented `make ui-fixtures` command that captures the added screenshots.

- [ ] **Step 1: Add the unshot spec to the existing pages/screen capture command.**
- [ ] **Step 2: Document the additional screenshot groups and keep generated artifacts ignored.**
- [ ] **Step 3: Run `make -n ui-fixtures` to verify ordering and one-build behavior.**

### Task 3: Verify the complete fixture workflow

**Files:**
- Test: generated WDIO artifact directories under ignored `artifacts/e2e/`

- [ ] **Step 1: Run the unified target with the configured Node runtime PATH.**
- [ ] **Step 2: Verify all specs pass and the expected new screenshot files exist.**
- [ ] **Step 3: Run repository format/type checks relevant to changed TypeScript and Make/Markdown files.**
- [ ] **Step 4: Confirm `git status --short` contains only intentional source changes and no screenshots.**

