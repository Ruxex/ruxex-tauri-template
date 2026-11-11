# Dummy home generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idempotent fixture-preparation command that uses WDIO to create one durable DummyProvider conversation in an ignored repository-local home.

**Architecture:** Keep the existing temporary-home behavior unchanged for normal E2E runs. Add an explicit `--dummy-home` runner mode that clears the short ignored repository-local `.d/` home, uses it as the isolated HOME, runs a dedicated fixture WDIO spec, and preserves the directory after the app process exits. The short path is required because the App Server Unix socket path includes `RUXEX_HOME`. The fixture uses existing Tauri/WDIO infrastructure internally but is named independently from E2E tests.

**Tech Stack:** Python `unittest`, Python filesystem/process utilities, WebdriverIO/TypeScript, Makefile, Tauri desktop E2E runner.

**Spec:** `docs/superpowers/specs/2026-11-06-dummy-home-generator-design.md`

## Global Constraints

- Generate durable state through the real desktop UI and App Server.
- Do not write SQLite or JSONL records directly.
- Reset the known fixture home before every dummy-home run.
- Keep generated data under ignored `.d/`.
- First version creates only one completed basic conversation.
- Do not add approval, user-input, streaming, project, or workspace-root setup yet.

## Review Focus

- A normal E2E run must still use a disposable temporary home: test `run_e2e` default behavior in Task 2.
- Dummy-home cleanup must not remove a parent directory or unrelated artifacts: test exact-directory reset in Task 1.
- A failed WDIO run must still terminate isolated app-server descendants: preserve existing cleanup path and run the new command in Task 3.
- The fixture must survive process shutdown: verify the output directory remains after the command in Task 3.
- Rerunning must not accumulate chats: run the command twice and inspect the resulting home in Task 4.

## File Map

- Modify `scripts/tauri_e2e_runner.py`: expose the fixed dummy-home path, reset it safely, and add the `--dummy-home` option.
- Modify `scripts/test_tauri_e2e_runner.py`: cover reset and mode-selection behavior.
- Create `fixtures/dummy-home/prepare.spec.ts`: create and wait for one completed deterministic basic conversation.
- Modify `Makefile`: add `prepare-dummy-home` and help text.
- Modify `.gitignore`: ignore `.d/`.
- Modify `biome.json`: include the new fixture spec in formatting/lint scope.

### Task 1: Add the persistent-home reset contract

**Files:**
- Modify: `scripts/test_tauri_e2e_runner.py`
- Modify: `scripts/tauri_e2e_runner.py`

**Interfaces:**
- Produce `DUMMY_HOME_DIR: Path` pointing to `REPOSITORY_ROOT / ".d"`.
- Produce `prepare_persistent_dummy_home() -> Path`, which removes only the existing `DUMMY_HOME_DIR` and recreates it empty.

- [ ] **Step 1: Write the failing tests**

Add a test that monkeypatches `tauri_e2e_runner.DUMMY_HOME_DIR` to a temporary
directory containing stale files and asserts that
`prepare_persistent_dummy_home()` returns that directory, leaves it present,
and removes the stale contents. Add a test that the helper does not remove a
sibling directory in the same parent.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

Expected: FAIL because the constant and helper do not exist.

- [ ] **Step 3: Implement the minimal reset helper**

Add the fixed path constant and implement `prepare_persistent_dummy_home()`
with `shutil.rmtree` on the exact target path followed by `mkdir(parents=True)`.
Do not broaden the deletion target to `artifacts/` or the repository root.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

Expected: all runner unit tests pass.

### Task 2: Add runner mode selection without changing default E2E behavior

**Files:**
- Modify: `scripts/test_tauri_e2e_runner.py`
- Modify: `scripts/tauri_e2e_runner.py`

**Interfaces:**
- Change `run_e2e(headless: bool, spec: str | None = None, dummy_home: bool = False) -> int`.
- Change `parse_args()` to expose `--dummy-home` as a boolean option.
- Change `main()` to pass `arguments.dummy_home` to `run_e2e`.

- [ ] **Step 1: Write the failing tests**

Add a test for argument parsing where `--dummy-home` is true and a test that
the default parsed value is false. Add a focused test around the home-selection
helper or runner setup asserting that dummy-home mode uses
`DUMMY_HOME_DIR`, while default mode still creates a temporary home.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

Expected: FAIL because the new argument and mode behavior do not exist.

- [ ] **Step 3: Implement the runner mode**

Refactor only the home-lifetime portion of `run_e2e`: dummy-home mode calls
`prepare_persistent_dummy_home()` and keeps the directory after the run;
default mode keeps the existing `TemporaryDirectory` lifecycle. Both modes
must still call `prepare_dummy_provider_home`, write artifacts, and execute the
same subprocess cleanup path.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

Expected: all runner unit tests pass.

### Task 3: Add the minimal WDIO fixture scenario and command

**Files:**
- Create: `fixtures/dummy-home/prepare.spec.ts`
- Modify: `Makefile`
- Modify: `.gitignore`

**Interfaces:**
- The WDIO spec creates exactly one basic completed chat from the initial
  composer using the deterministic input `Fixture basic conversation example:basic`.
- The Make target is `prepare-dummy-home` and runs the spec with
  `--dummy-home` after building the debug app. It is headful for now because
  the repository does not yet require an Xvfb dependency.

- [ ] **Step 1: Write the WDIO scenario**

Wait for the initial heading and `textarea[aria-label="Message"]`, enter the
fixed message, wait for `button[aria-label="Send"]` to become enabled, click
it, wait for the URL to contain `#/chat/`, and wait for the chat main content
to be displayed after the turn completes. Keep selectors semantic and avoid
fixed sleeps.

- [ ] **Step 2: Run the new spec before adding the Make target**

Run: `GDK_BACKEND=x11 RUXEX_E2E_PLUGIN=0 python3 scripts/tauri_e2e_runner.py --spec fixtures/dummy-home/prepare.spec.ts`

Expected: the scenario itself runs against the existing disposable-home
runner; any failure should identify a selector or wait-condition issue before
adding the new fixture mode.

- [ ] **Step 3: Add the ignored output directory and Make target**

Add `.d/` to `.gitignore`. Add `prepare-dummy-home` to
`.PHONY`, help text, and a target that depends on `e2e-build` and invokes the
runner with `--dummy-home --spec fixtures/dummy-home/prepare.spec.ts`.

- [ ] **Step 4: Run the command once**

Run: `make prepare-dummy-home`

Expected: exit code 0 and a preserved `.d/` containing
the generated Ruxex home.

### Task 4: Verify idempotence and the existing test suite

**Files:**
- No additional files.

- [ ] **Step 1: Run the fixture command a second time**

Run: `make prepare-dummy-home`

Expected: exit code 0; the command starts from a clean home and does not fail
because a previous database, auth file, or session exists.

- [ ] **Step 2: Confirm the generated home is ignored**

Run: `git status --short --ignored .d/`

Expected: generated files are listed as ignored and no generated home file is
shown as an untracked change.

- [ ] **Step 3: Run Python runner tests**

Run: `python3 -m unittest discover -s scripts -p 'test_*.py' -v`

Expected: all Python tests pass.

- [ ] **Step 4: Run frontend checks**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit successfully.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the intended source, test, spec, plan,
Makefile, and gitignore changes are present, with generated home data ignored.
