# Chat UI Fixture States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add screenshot scenarios for active/completed chat turns, completed-turn expansion, and the wide-layout conversation minimap.

**Architecture:** Add volatile scenario IDs to the existing dummy-home catalog and implement their deterministic browser flows in `volatile.spec.ts`, reusing provider markers already supported by the Example provider. Add small support helpers for screenshot-safe window sizing, details expansion, and repeated basic turns.

**Tech Stack:** WebdriverIO, TypeScript, Vitest, existing Tauri E2E runner and screenshot gallery.

**Spec:** `docs/superpowers/specs/2026-11-11-ui-fixture-chat-states-design.md`

## Global Constraints

- Keep the Example provider unchanged.
- Do not change production chat rendering or minimap breakpoints.
- Do not change persistent fixture catalog counts.
- Keep screenshots deterministic and named by visible state.

## Review Focus

- Slow long stream: the screenshot must be taken while the Stop button and Working indicator are visible.
- Completed long stream: the screenshot must wait for the final response before capture.
- Completed details: the collapsed screenshot must show a closed `Worked for ...` summary; the expanded screenshot must show the intermediate items.
- Minimap: the scenario must create at least seven user messages and show all markers in the left-side minimap.
- Cleanup: a widened minimap scenario must restore the original window size for later scenarios.

---

### Task 1: Add chat-state screenshot scenarios

**Files:**
- Modify: `fixtures/dummy-home/catalog.ts`
- Modify: `fixtures/dummy-home/volatile.spec.ts`
- Modify: `fixtures/dummy-home/support.ts`
- Modify: `fixtures/dummy-home/catalog.test.ts`
- Modify: `fixtures/dummy-home/support.test.ts`

**Interfaces:**
- Consumes: existing `VOLATILE_SCENARIOS`, Example provider markers, and screenshot helpers.
- Produces: four additional volatile fixture cases and four screenshot files:
  `long-stream-running.png`, `long-stream-completed.png`,
  `completed-turn-details-collapsed.png`,
  `completed-turn-details-expanded.png`, and `conversation-minimap.png`.

- [ ] **Step 1: Write failing catalog/support tests**

  Assert the active volatile catalog contains the new scenario IDs and that
  support helpers build the expected prompt/turn count and preserve the
  original window size after a scoped resize.

- [ ] **Step 2: Run the focused fixture tests and verify they fail**

  Run: `pnpm vitest run fixtures/dummy-home/catalog.test.ts fixtures/dummy-home/support.test.ts`

- [ ] **Step 3: Add catalog entries and browser helpers**

  Add scenarios for running long, completed long, completed-turn expansion,
  and minimap capture. Add helpers that resize the current window within a
  `try/finally`, send seven deterministic `example:basic` turns, wait for a
  `details` summary, and click its `summary`.

- [ ] **Step 4: Implement the volatile screenshot flows**

  Capture the running long stream before stopping it, capture the completed
  long stream after `waitForTurnFinish`, use `example:workflow` for collapsed
  and expanded completed-turn screenshots, and use the repeated-turn helper
  plus a wide window for the minimap screenshot.

- [ ] **Step 5: Run focused tests and the volatile E2E spec**

  Run the Vitest command from Step 2 and:

  ```bash
  GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-events --spec fixtures/dummy-home/volatile.spec.ts
  ```

  Expected: all catalog/support tests pass and all active volatile scenarios
  pass with the four new PNGs in the artifact directory.

- [ ] **Step 6: Run `make ui-fixtures` and verify the gallery**

  Run `make ui-fixtures`, inspect the four new screenshots, and refresh the
  port-8765 gallery to the newest complete batch.

- [ ] **Step 7: Run final checks**

  Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`.
