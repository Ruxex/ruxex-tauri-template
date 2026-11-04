# App Server Control Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make App Server control buttons visually distinct and place reconnect on the same action row as daemon controls.

**Architecture:** Keep the existing `AppServerCard` props and callbacks. Change only the action-row markup and button classes, then pin the layout and semantic variants with component tests.

**Tech Stack:** React, TypeScript, Tailwind/DaisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-app-server-control-buttons-design.md`

## Global Constraints

- Preserve existing App Server action callbacks and disabled behavior.
- Keep controls in one responsive flex row.
- Use `btn-outline`, `btn-success`, `btn-warning`, and `btn-error` for the four actions.

## Review Focus

- In-process mode: Reconnect remains available while daemon controls stay hidden.
- Daemon mode: all four controls share one action container.
- Pending/fetching state: existing disabled behavior remains unchanged.

### Task 1: Update App Server controls

**Files:**
- Modify: `src/components/settings/SettingsCards.tsx`
- Test: `src/components/settings/SettingsLayout.test.tsx`

**Interfaces:**
- Consumes: existing `AppServerCard` props.
- Produces: unchanged callbacks with semantic visual variants and a shared action row.

- [ ] Write a failing test asserting one shared action container and the four expected variants in daemon mode.
- [ ] Run the focused settings test and confirm it fails against the current all-neutral, two-row markup.
- [ ] Update `AppServerCard` so the controls use the approved variants in one `flex flex-wrap` action row.
- [ ] Run the focused settings test and the full Vitest suite.
- [ ] Run TypeScript, Biome, ESLint, and the production build.
- [ ] Commit as `fix(desktop): distinguish app server controls`.
