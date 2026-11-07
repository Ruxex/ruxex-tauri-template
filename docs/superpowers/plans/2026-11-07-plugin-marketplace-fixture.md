# Plugin Marketplace Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a separate, idempotent WDIO fixture runner that uses the real sibling `openai-plugins` checkout through a repository-relative path and prepares empty, uninstalled, and installed marketplace UI states.

**Architecture:** Add a dedicated `--marketplace-home` runner mode and a dedicated `wdio.marketplace-home.conf.mjs`/`fixtures/marketplace-home/` suite. The suite resolves `../../openai-plugins` from the repository root at runtime, adds it through `/settings/marketplaces`, and performs plugin installation through the existing UI. The generated `.m/` home remains ignored and separate from the DummyProvider catalog.

**Tech Stack:** Python `argparse`/`pathlib`, TypeScript WDIO, Vitest, WebdriverIO Tauri driver, real Ruxex App Server v0.6.1.

**Spec:** `docs/superpowers/specs/2026-11-07-plugin-marketplace-fixture-design.md`

## Global Constraints

- Use the real local `openai-plugins` checkout; do not copy its contents into this repository.
- Store only `../../openai-plugins` in tracked fixture code; resolve it to an absolute path at runtime.
- Create marketplace and plugin state through the desktop UI and App Server flows, not direct config, database, or plugin-store writes.
- Keep generated homes and screenshots ignored.
- Keep the marketplace fixture separate from the existing DummyProvider persistent and volatile suites.
- Use headful execution initially; retain the existing optional headless wrapper.

## Review Focus

- Missing sibling checkout: resolver fails with a clear path-specific error before starting WDIO; test in `fixtures/marketplace-home/support.test.ts`.
- Relative path leakage: fixture source contains no `/home/` or other absolute path; test the exported relative constant and runtime resolver.
- Repeated preparation: marketplace home is reset only within its own target and remains after the runner exits; test in `scripts/test_tauri_e2e_runner.py`.
- Empty marketplace response: UI asserts `No plugin marketplaces available.` before adding the source.
- Changed upstream plugin catalog: UI asserts the selected marketplace and plugin names and fails clearly if a selected plugin disappears.

---

### Task 1: Add the isolated marketplace runner mode

**Files:**
- Modify: `scripts/tauri_e2e_runner.py`
- Modify: `scripts/test_tauri_e2e_runner.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces `parse_args(["--marketplace-home"]).marketplace_home == True`.
- Produces `prepare_persistent_marketplace_home() -> Path`.
- Extends `_run_home(dummy_home, dummy_events, marketplace_home)` with mutually exclusive persistent fixture modes.
- Selects `wdio.marketplace-home.conf.mjs` for marketplace mode.

- [x] **Step 1: Add failing Python tests** for the new argument, mutually-exclusive fixture modes, target reset, missing-target behavior for any future event mode, and marketplace WDIO command/config selection.
- [x] **Step 2: Run the focused tests** with `python3 -m unittest scripts.test_tauri_e2e_runner`; confirm the new assertions fail before implementation.
- [x] **Step 3: Implement the mode** using a short ignored repository-local target such as `MARKETPLACE_HOME_DIR = REPOSITORY_ROOT / ".m"`; reset only that directory, add the argparse flag, thread it through `run_e2e()` and `main()`, and use the dedicated WDIO config. Reuse the existing isolated environment and provider setup only as needed to boot the desktop; do not add marketplace files directly.
- [x] **Step 4: Update `.gitignore`** to ignore `/.m/` and keep generated marketplace homes untracked.
- [x] **Step 5: Run the focused tests** again and require PASS.

### Task 2: Create runtime source-path resolution helpers

**Files:**
- Create: `fixtures/marketplace-home/support.ts`
- Create: `fixtures/marketplace-home/support.test.ts`

**Interfaces:**
- Produces `MARKETPLACE_SOURCE_RELATIVE_PATH = "../../openai-plugins"`.
- Produces `resolveMarketplaceSource(repositoryRoot?: string): string`, which resolves the relative path, verifies it is a directory, and throws an actionable error if missing.
- Produces shared navigation helpers for marketplace settings, capabilities, and plugin detail pages.

- [x] **Step 1: Write Vitest tests** that assert the relative constant is not absolute, resolution returns `path.resolve(repositoryRoot, relativePath)`, and a missing checkout produces an error containing the resolved path.
- [x] **Step 2: Run `pnpm exec vitest run fixtures/marketplace-home/support.test.ts`** and confirm the new tests fail because the helper does not exist.
- [x] **Step 3: Implement the resolver** using `import.meta.url`, `node:path`, and `node:fs`; derive the repository root from the fixture module location, then call `path.resolve()` and `statSync().isDirectory()`.
- [x] **Step 4: Implement navigation helpers** with stable existing selectors: `/settings/marketplaces`, `/capabilities`, `data-testid="plugin-marketplace"`, plugin links, and `/capabilities/plugins/:marketplace/:plugin` routes.
- [x] **Step 5: Run the focused Vitest test** and require PASS.

### Task 3: Add the marketplace WDIO configuration and persistent scenario

**Files:**
- Create: `wdio.marketplace-home.conf.mjs`
- Create: `fixtures/marketplace-home/persistent.spec.ts`
- Modify: `Makefile`

**Interfaces:**
- The WDIO config runs only `fixtures/marketplace-home/**/*.spec.ts` with the existing Tauri binary and no additional service.
- The scenario uses `resolveMarketplaceSource()` and leaves `.m/` containing the App Server-managed marketplace/plugin state.
- The scenario writes only ignored artifacts named `marketplace-empty.png`, `marketplace-list.png`, `marketplace-notion-detail.png`, `marketplace-installed-list.png`, and `marketplace-build-web-apps-detail.png`.

- [x] **Step 1: Add the scenario assertions** for the empty state, configured `openai-curated` marketplace, actual plugin listing, pre-install detail, post-install state, installed sidebar entry, and a second plugin that remains uninstalled.
- [x] **Step 2: Run the existing focused unit checks** and confirm the new scenario is not included in the DummyProvider spec glob.
- [x] **Step 3: Implement the WDIO config** by adapting the service-free Tauri config and limiting `specs` to the new fixture directory.
- [x] **Step 4: Implement the persistent scenario** with explicit selected names (`notion` for the uninstalled detail and `build-web-apps` for install) and UI operations only:
  - open `/capabilities` and assert the empty message;
  - save `marketplace-empty.png`;
  - add the resolved source through `/settings/marketplaces`;
  - assert the marketplace display name and plugin count/category content;
  - save `marketplace-list.png`;
  - open `notion` detail before installation;
  - save `marketplace-notion-detail.png`;
  - install `build-web-apps` from its card and wait for its installed state;
  - save `marketplace-installed-list.png`;
  - reopen its detail page and assert Skills/Information content;
  - save `marketplace-build-web-apps-detail.png`;
  - open the capabilities sidebar and assert `Build Web Apps` is listed while `Notion` is not installed.
- [x] **Step 5: Add `prepare-marketplace-home`** to `Makefile` and the help output, invoking `--marketplace-home --spec fixtures/marketplace-home/persistent.spec.ts` without including screenshots in source control.
- [x] **Step 6: Run the new headful fixture** and require one passing WDIO spec. Inspect generated screenshots manually when present under ignored artifacts.

### Task 4: Verify, document, and review the fixture

**Files:**
- Modify: `README.md`
- Modify: `scripts/test_tauri_e2e_runner.py` if verification reveals missing runner coverage

- [x] **Step 1: Document** the new command, the required sibling checkout location, the relative-path resolution behavior, and the fact that `.m/` and screenshots are ignored.
- [x] **Step 2: Run all relevant checks:** `python3 -m unittest discover -s scripts -p 'test_*.py'`, `pnpm exec vitest run`, `pnpm typecheck`, `pnpm lint`, the explicit changed-file Biome formatting check, and `git diff --check`. The repository-wide Biome check reports pre-existing formatting diagnostics outside this fixture.
- [x] **Step 3: Run `git status --short --ignored`** and verify only ignored `.m/`/artifact outputs are generated; no screenshots or absolute path data are tracked.
- [x] **Step 4: Review the diff** against the design spec, then commit the implementation without adding generated homes or screenshots.
