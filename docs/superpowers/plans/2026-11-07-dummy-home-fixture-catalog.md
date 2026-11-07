# Dummy Home Fixture Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the UI-driven DummyProvider fixture from one basic thread into an adjustable persistent catalog plus a separate volatile-event scenario runner.

**Architecture:** Keep `scripts/tauri_e2e_runner.py` responsible for process isolation and add an explicit volatile mode that reuses, but does not reset, the prepared `.d/` home. Put scenario data and expected counts in a TypeScript catalog, share WDIO UI helpers between the persistent and volatile specs, and make the specs perform all data creation through accessible UI operations.

**Tech Stack:** TypeScript, WebdriverIO v10, Mocha, real Tauri binary, Python runner, DummyProvider, Vitest, Biome, and existing App Server protocol/UI.

**Spec:** `docs/superpowers/specs/2026-11-07-dummy-home-fixture-catalog-design.md`

## Global Constraints

- All durable data is created by the real desktop app through WDIO.
- The persistent home remains the short ignored path `/.d/` because the App Server Unix socket path includes `RUXEX_HOME`.
- The fixture is headful for now; headless execution can be added when the environment provides `xvfb-run`.
- Projects are created without workspace roots.
- Counts are catalog values and must be adjustable without changing runner architecture.
- Pending approvals, user-input cards, and streaming states are volatile and must not be represented by direct database writes.
- The standard approval UI has Allow and Deny but no Cancel; `approval:cancel` is not a persistent UI-created scenario.

## Review Focus

- Scenario counts and organization transformations must produce exactly 14 total, 12 active, and 2 archived threads; pin this in the catalog test and persistent WDIO assertions.
- A volatile run must preserve an existing `.d/` sentinel and must fail clearly when the persistent home has not been prepared; pin this in Python runner tests.
- Projects must remain machine-independent by using zero workspace roots while still exercising project metadata and project-scoped chats; pin this in the project helper flow and project page assertions.
- Approval and user-input requests must be resolved only through their rendered controls, with no hidden protocol or SQLite shortcut; pin this in the persistent and volatile WDIO scenarios.
- Durable history must render after the originating event stream is gone; pin this by reopening representative threads after the persistent preparation flow and by running a fresh app process in the integration command.

---

### Task 1: Add the scenario catalog and count contracts

**Files:**
- Create: `fixtures/dummy-home/catalog.ts`
- Create: `fixtures/dummy-home/catalog.test.ts`

**Interfaces:**
- Produces `PersistentScenarioId`, `PersistentScenario`, `PersistentScenario[]`, `ProjectFixture`, `VolatileScenario`, and the exported constants `PERSISTENT_SCENARIOS`, `PROJECT_FIXTURES`, `VOLATILE_SCENARIOS`.
- Produces `persistentFixtureCounts()` returning `{ total: 14, active: 12, archived: 2 }` for the default catalog.
- Produces deterministic title and marker builders used by both specs, with occurrence numbers formatted as two digits.

- [ ] **Step 1: Write the failing catalog tests**

  Add tests asserting unique scenario IDs, the exact default totals, the absence of `approval-cancelled`, the presence of `command-list`, deterministic titles/markers, project counts `2/1/0`, and six active volatile scenarios with MCP count `0`.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm exec vitest run fixtures/dummy-home/catalog.test.ts`

  Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Implement the catalog**

  Define immutable records for the 14 persistent threads, the three rootless projects, and the volatile scenarios. Keep scenario-specific provider markers and expected UI outcomes in the records instead of scattering strings through WDIO code.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm exec vitest run fixtures/dummy-home/catalog.test.ts`

  Expected: PASS.

- [ ] **Step 5: Run typecheck and formatting for the new fixture module**

  Run: `pnpm typecheck` and `pnpm exec biome check fixtures/dummy-home/catalog.ts fixtures/dummy-home/catalog.test.ts`

  Expected: both commands pass.

- [ ] **Step 6: Commit**

  ```bash
  git add fixtures/dummy-home/catalog.ts fixtures/dummy-home/catalog.test.ts
  git commit -m "test: define dummy home fixture catalog"
  ```
### Task 2: Build shared WDIO UI-operation helpers

**Files:**
- Create: `fixtures/dummy-home/support.ts`
- Create: `fixtures/dummy-home/support.test.ts`
- Modify: `wdio.dummy-home.conf.mjs` only if shared timeout or artifact configuration is required

**Interfaces:**
- Consumes the catalog types and marker builders from Task 1.
- Produces `waitForDesktopReady()`, `openNewChat()`, `sendScenario()`, `sendFollowUp()`, `waitForCompletedTurn()`, `waitForPendingRequest()`, `resolveApproval()`, `submitUserInput()`, `createRootlessProject()`, `openProjectChat()`, `archiveCurrentThread()`, `setCurrentGoal()`, and `saveFixtureScreenshot()`.
- All helpers operate through accessible roles, labels, links, and rendered text; no helper may call `requestAppServerMethod`, `resolveServerRequest`, or read SQLite.

- [ ] **Step 1: Add helper-level tests for deterministic input and expectation functions**

  Extract pure prompt/expected-text functions where useful and test that every catalog scenario maps to one marker and one completion/error predicate. Keep browser interaction itself covered by the WDIO specs.

- [ ] **Step 2: Run the focused helper test to verify it fails**

  Run: `pnpm exec vitest run fixtures/dummy-home/support.test.ts`

  Expected: FAIL until the pure helper contract is present.

- [ ] **Step 3: Implement the shared WDIO helpers**

  Centralize readiness checks for `Let's get started`, `main`, `ModelABC`, and the absence of `app-server is not connected`. Use the existing composer labels and request-card controls (`Allow`, `Deny`, `Submit`) and wait for the corresponding visible completion text or error state before returning.

- [ ] **Step 4: Run focused helper tests and typecheck**

  Run: `pnpm exec vitest run fixtures/dummy-home/support.test.ts` and `pnpm typecheck`

  Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add fixtures/dummy-home/support.ts fixtures/dummy-home/support.test.ts wdio.dummy-home.conf.mjs
  git commit -m "test: add dummy home WDIO fixture helpers"
  ```

### Task 3: Replace the basic fixture with the persistent catalog runner

**Files:**
- Create: `fixtures/dummy-home/persistent.spec.ts`
- Delete: `fixtures/dummy-home/prepare.spec.ts`
- Modify: `Makefile`

**Interfaces:**
- Consumes the catalog from Task 1 and UI helpers from Task 2.
- Produces the default persistent home with 14 durable threads, 3 rootless projects, 2 archived threads, and one persisted goal.
- The Make target remains `make prepare-dummy-home` and points at `fixtures/dummy-home/persistent.spec.ts`.

- [ ] **Step 1: Write the persistent WDIO scenario assertions**

  Add ordered `describe` blocks that create the three projects, create all catalog conversations, resolve the two supported approval variants, create the goal-only thread, archive the designated records, and create three designated conversations through project-scoped new-chat flows. Add final UI assertions for active thread count 12, archive count 2, project count 3, and project thread counts 2/1/0.

- [ ] **Step 2: Run the persistent spec against the current helper set to verify it fails**

  Run: `make e2e-build` followed by `GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --dummy-home --spec fixtures/dummy-home/persistent.spec.ts`

  Expected: FAIL because the new spec and helpers are not yet implemented.

- [ ] **Step 3: Implement the persistent WDIO flow**

  Create threads only by clicking the visible New chat link, entering catalog markers into the composer, and waiting for each durable outcome. For multi-turn use three sequential submissions in the same thread. For approval scenarios click the rendered Allow or Deny control and wait for the fixed continuation. Create projects with empty roots and select distinct icon/color controls. Archive only after the target thread has a completed history.

- [ ] **Step 4: Update the Make target and run the persistent fixture**

  Run: `make prepare-dummy-home`

  Expected: WDIO passes and the generated `.d/` remains present.

- [ ] **Step 5: Verify restart-readable state**

  Run `make prepare-dummy-home` a second time and use the UI assertions in the spec to confirm the same counts. Reopen representative Markdown, command, failed, multi-turn, project, and archived threads before the spec exits.

- [ ] **Step 6: Commit**

  ```bash
  git add fixtures/dummy-home/persistent.spec.ts Makefile
  git rm fixtures/dummy-home/prepare.spec.ts
  git commit -m "test: populate persistent dummy home catalog"
  ```

### Task 4: Add an explicit volatile-event runner mode

**Files:**
- Modify: `scripts/tauri_e2e_runner.py`
- Modify: `scripts/test_tauri_e2e_runner.py`
- Modify: `Makefile`

**Interfaces:**
- Adds `--dummy-events` as a mutually exclusive CLI option with `--dummy-home`.
- Extends `run_e2e(headless: bool, spec: str | None = None, dummy_home: bool = False, dummy_events: bool = False) -> int`.
- Adds a home-mode helper that resets `.d/` only for persistent mode, preserves it for volatile mode, and continues using a temporary home for normal E2E.
- Adds Make target `dummy-home-events` for the volatile spec.

- [ ] **Step 1: Write failing Python tests**

  Test parsing `--dummy-events`, mutual exclusion with `--dummy-home`, preservation of a sentinel file in volatile mode, failure when `.d/` is absent, and metadata identifying the selected mode.

- [ ] **Step 2: Run the focused Python tests to verify they fail**

  Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

  Expected: FAIL for the new CLI and home-mode cases.

- [ ] **Step 3: Implement volatile mode**

  Keep the existing persistent `--dummy-home` behavior unchanged. For `--dummy-events`, require the known `.d/` directory, preserve its contents, use the dedicated service-free WDIO config and external `tauri-driver`, and record `fixture_mode` in `run.json`.

- [ ] **Step 4: Run Python tests and formatting checks**

  Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v` and `git diff --check`

  Expected: all runner tests pass and there is no whitespace error.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/tauri_e2e_runner.py scripts/test_tauri_e2e_runner.py Makefile
  git commit -m "test: add volatile dummy event runner mode"
  ```

### Task 5: Add the volatile event screenshot scenarios

**Files:**
- Create: `fixtures/dummy-home/volatile.spec.ts`
- Modify: `fixtures/dummy-home/support.ts`

**Interfaces:**
- Consumes `VOLATILE_SCENARIOS` and the shared UI helpers.
- Produces deterministic screenshots under the current run artifact directory,
  named by scenario ID, without direct protocol or database operations.

- [ ] **Step 1: Write the volatile WDIO assertions**

  Add one scenario per default volatile entry: pending approval, pending user input, pending permissions, slow stream, queued message, and disconnect recovery. Each scenario must wait for the visible state before taking its screenshot; pending-card scenarios must not resolve the card before capture.

- [ ] **Step 2: Run the volatile spec before implementation to verify it fails**

  Run: `make prepare-dummy-home` followed by `make dummy-home-events`

  Expected: FAIL until the volatile spec exists and the new runner mode is wired.

- [ ] **Step 3: Implement the volatile scenarios**

  Start each scenario through the normal New chat composer, use the existing DummyProvider marker, save a screenshot to `RUXEX_E2E_ARTIFACTS`, and cleanly finish or interrupt the scenario after capture so the WDIO process can exit. Keep the MCP elicitation scenario out of the default run until deterministic MCP setup is available.

- [ ] **Step 4: Run the volatile suite and inspect artifacts**

  Run: `make dummy-home-events`

  Expected: six scenario passes, one screenshot per scenario, and no deletion of pre-existing `.d/` files.

- [ ] **Step 5: Commit**

  ```bash
  git add fixtures/dummy-home/volatile.spec.ts fixtures/dummy-home/support.ts
  git commit -m "test: add volatile dummy event screenshots"
  ```

### Task 6: Document commands and run the complete verification matrix

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-07-dummy-home-fixture-catalog-design.md` only if implementation details require a clarified note

**Interfaces:**
- Documents `make prepare-dummy-home` as the persistent rebuild command and `make dummy-home-events` as the volatile screenshot command.
- Documents the default counts and the fact that volatile runs may create transient durable history when using the prepared home.

- [ ] **Step 1: Add the user-facing command and count documentation**

  Explain the ignored `.d/` location, the 14/12/2 persistent counts, the 3 project counts, the six volatile scenarios, headful execution, and the fact that pending requests are not persisted.

- [ ] **Step 2: Run repository verification**

  Run:

  ```bash
  python3 -m unittest discover -s scripts -p 'test_*.py' -v
  pnpm exec vitest run
  pnpm typecheck
  pnpm lint
  PATH=/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH python3 scripts/check_changed_format.py
  git diff --check
  ```

  Expected: all commands pass.

- [ ] **Step 3: Run both fixture commands from a clean persistent rebuild**

  Run `make prepare-dummy-home`, inspect the generated screenshots/logs, then run `make dummy-home-events` without rebuilding the home. Confirm `git status --short --ignored .d artifacts` reports the generated directories as ignored.

- [ ] **Step 4: Commit documentation and final verification**

  ```bash
  git add README.md docs/superpowers/specs/2026-11-07-dummy-home-fixture-catalog-design.md
  git commit -m "docs: document dummy home fixture catalog"
  ```
