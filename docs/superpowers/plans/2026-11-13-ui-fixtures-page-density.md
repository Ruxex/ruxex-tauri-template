# UI Fixtures Page Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `make ui-fixtures` to capture real pages with representative ordinary and large data sets, plus their meaningful page-level interaction states.

**Architecture:** Keep WDIO as the real-app capture path. Build a deterministic ordinary home, capture its pages, then extend that same home through the UI for large-data captures; keep transient states in the existing volatile suite and marketplace states in their own home. Update the ordered run catalog and docs so the screenshot gallery can identify a complete batch.

**Tech Stack:** Tauri, WebdriverIO, TypeScript, DummyProvider, Make, Python screenshot gallery.

**Spec:** `docs/superpowers/specs/2026-11-13-ui-fixtures-page-density-design.md`

## Global Constraints

- Create and change app state through GUI or accessibility interactions, not direct App Server, Tauri, or DOM state injection.
- Capture real page composition; isolated component catalog screenshots are out of scope.
- Keep `make ui-fixtures` as the single complete capture entry point.
- Do not commit generated screenshots or fixture homes.

## Review Focus

- The standard and large data runs must recreate deterministically from a clean home and must not depend on an earlier manual run.
- Large fixtures must cross visible list/page boundaries where supported so existing pagination and overflow behavior is visible.
- Page-level screenshots must wait for meaningful content, not just route headings.
- Large fixture creation must leave the home usable by the volatile and marketplace capture suites.
- Screenshot gallery batch detection must include every new run in the correct order.

## File Structure

- `fixtures/dummy-home/catalog.ts`: data sizes and reusable labels for persistent and expanded data sets.
- `fixtures/dummy-home/persistent.spec.ts`: create baseline representative threads and projects through WDIO.
- `fixtures/dummy-home/pages.spec.ts`: capture ordinary-density page states after the baseline is prepared.
- `fixtures/dummy-home/large-data.spec.ts`: add extra page data through visible controls and capture high-density states.
- `fixtures/dummy-home/support.ts`: shared UI-only data creation and content-ready waits.
- `Makefile`: run baseline, ordinary capture, large-data extension/capture, volatile, marketplace, and Git-diff fixtures in order.
- `scripts/screenshot-gallery/server.py` and `scripts/screenshot-gallery/test_server.py`: recognize the expanded complete-run sequence and group density screenshots by page.
- `README.md` and `scripts/ui-fixtures/README.md`: document coverage, density meaning, and generated artifacts.

## Tasks

### Task 1: Define stable density data and page capture inventory

**Files:**
- Modify: `fixtures/dummy-home/catalog.ts`
- Modify: `fixtures/dummy-home/catalog.test.ts` only if the user later requests test coverage
- Modify: `fixtures/dummy-home/pages.spec.ts`

**Interfaces:**
- Produces: named ordinary and large fixture counts, and a route/state inventory whose screenshot names include page plus density or interaction state.
- Consumes: existing page routes, semantic selectors, and scenario catalog.

- [x] Inventory current routes and useful states; retain empty states only where they are meaningful, and add ordinary populated captures for data-bearing pages.
- [x] Define large counts per data surface. At minimum, archive data must exceed its 50-row page size, active chats must exceed the 8-row sidebar window, and projects/schedules must extend beyond one visible viewport.
- [x] Give page density screenshots stable names such as `projects-ordinary.png` and `projects-many.png`; make selectors wait for data-bearing content.

### Task 2: Create and capture expanded page data through WDIO

**Files:**
- Modify: `fixtures/dummy-home/persistent.spec.ts`
- Create: `fixtures/dummy-home/large-data.spec.ts`
- Modify: `fixtures/dummy-home/support.ts`
- Modify: `Makefile`

**Interfaces:**
- Consumes: density counts and labels from Task 1.
- Produces: a reproducible ordered workflow where the baseline home feeds ordinary screenshots, the large-data spec extends it through visible app controls and captures overflow/pagination states, and later volatile suites still run.

- [x] Keep baseline creation restartable and capture normal data before adding the large set.
- [x] Add project, thread, archive, and schedule records through real UI forms/actions as those surfaces support them; assert visible counts/pages before saving each screenshot.
- [x] Capture the next archive page and any existing list overflow behavior; do not add product pagination as part of fixture work.
- [x] Order the large-data run after ordinary page captures and before transient-state captures in `make ui-fixtures`.

### Task 3: Keep the gallery and documentation aligned

**Files:**
- Modify: `scripts/screenshot-gallery/server.py`
- Modify: `scripts/screenshot-gallery/test_server.py`
- Modify: `README.md`
- Modify: `scripts/ui-fixtures/README.md`

**Interfaces:**
- Consumes: ordered spec list and screenshot naming from Tasks 1–2.
- Produces: latest-batch selection across all fixture runs and documentation describing actual coverage and ordinary/large data sizes.

- [x] Add new WDIO specs to complete batch detection in their execution order and update page grouping for the new screenshot prefixes.
- [x] Document the ordinary and large data captures, including which screens expose existing paging or scrolling.
- [x] Keep generated output under ignored artifact/home directories.

## Verification

- `make -n ui-fixtures` showed the complete ordered command list, with the large-data suite inside the HTTP MCP fixture server lifecycle.
- `make ui-fixtures` completed after the page-readiness review fix: baseline, ordinary pages, unshot states, large data, 10 volatile states, Marketplace, and Git diff review all passed. The seven capture runs produced 81 screenshots.
- `python3 scripts/screenshot-gallery/test_server.py`: 5 tests passed.
- `git diff --check` passed; `git status --short` contains only intended source/docs files, with generated homes and screenshots ignored.
