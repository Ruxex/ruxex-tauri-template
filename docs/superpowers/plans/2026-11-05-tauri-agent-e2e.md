# Tauri Agent E2E Verification Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Wayland/XWayland-compatible WebdriverIO loop that launches the real Ruxex Tauri app, drives its WebView, preserves failure evidence, and later forwards frontend and Rust logs through a debug-only Tauri plugin.

**Architecture:** Use WebdriverIO with the external Linux WebDriver provider for the real Tauri binary. A small Python runner owns temporary HOME/XDG directories, environment setup, artifact capture, and optional Xvfb execution; `wdio.conf.ts` owns WebDriver capabilities and failure screenshots. Add `tauri-plugin-wdio` only in a later debug-only phase, with a separate E2E capability and configuration overlay so release builds keep the normal capability boundary.

**Tech Stack:** Tauri 2, Rust 1.98.1, React/TypeScript, Vite, pnpm, WebdriverIO Tauri service, `tauri-driver`, WebKitGTK WebDriver, XWayland/Xvfb, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-11-05-tauri-agent-e2e-design.md`

## Global Constraints

- The target project is `ruxex-tauri-template`.
- Use the external WebDriver provider for the first implementation; do not add `tauri-plugin-wdio-webdriver`.
- Use `GDK_BACKEND=x11` for the Wayland/XWayland path and Xvfb for headless execution.
- Use the existing Makefile as the repository verification entrypoint.
- Use a temporary HOME and XDG directories; never use the developer's normal Ruxex home or credentials.
- Keep E2E execution single-worker and deterministic.
- Prefer accessible names and roles; do not make screen coordinates or CSS layout selectors the normal contract.
- Keep E2E artifacts under an ignored directory and redact secrets from environment metadata and logs.
- Add `tauri-plugin-wdio` only as a debug/test dependency and register it only under `debug_assertions` or an equivalent test feature.
- Keep `wdio` permissions out of the normal `default` capability and explicitly select only the normal capability for release builds.
- Preserve unrelated working-tree changes, especially `src-tauri/src/app_server.rs` and `src-tauri/src/desktop.rs`.
- Do not commit or push changes unless the user explicitly requests it.

## Review Focus

- Wayland/XWayland and Xvfb must select a usable X11 display without changing the normal desktop session; cover this in runner environment tests and both E2E commands.
- Missing Node.js, WebKitGTK WebDriver, `tauri-driver`, Xvfb, or the app binary must fail with an actionable preflight error; cover command preflight behavior before running WebDriver.
- E2E must not write into the developer's existing HOME, XDG directories, or Ruxex product home; cover temporary environment construction and cleanup.
- A failed test must preserve its original failure status while also saving a screenshot, page/UI state, stdout/stderr, and safe environment metadata; cover an intentional failure run.
- Release builds must not expose the WebDriver plugin, test execution API, or `wdio` capability; cover configuration assertions and a release-build boundary check.

---

## File Map

### Files to create

- `wdio.conf.ts` — WebdriverIO runner configuration, Tauri capabilities, timeouts, and failure artifact hooks.
- `e2e/desktop-smoke.spec.ts` — the first real-Tauri launch, navigation, composer, and send smoke tests.
- `e2e/diagnostics.spec.ts` — later plugin-enabled checks for Tauri execution and deterministic frontend log forwarding.
- `scripts/tauri_e2e_runner.py` — temporary environment setup, preflight checks, optional Xvfb invocation, and artifact lifecycle.
- `scripts/test_tauri_e2e_runner.py` — unit tests for runner environment, command construction, redaction, and failure propagation.
- `src-tauri/tauri.e2e.conf.json` — E2E-only Tauri configuration overlay enabling the E2E capability and global API only for the debug test build.
- `src-tauri/capabilities/e2e.json` — Linux E2E capability containing only the minimum `wdio` permissions required by diagnostics.

### Files to modify

- `package.json` — add WebdriverIO dependencies and E2E scripts.
- `pnpm-lock.yaml` — lock the selected WebdriverIO packages and later `@wdio/tauri-plugin`.
- `Makefile` — add debug E2E build, Wayland/XWayland E2E, and Xvfb E2E targets.
- `.gitignore` — ignore `artifacts/e2e/` and any local E2E-only generated state.
- `AGENTS.md` — document the Codex E2E loop, isolation requirements, artifact inspection, and release boundary.
- `README.md` — document host prerequisites and the supported E2E commands.
- `src-tauri/Cargo.toml` — later add `tauri-plugin-wdio` under debug-only dependencies.
- `src-tauri/src/lib.rs` — later register `tauri-plugin-wdio` only for debug/test builds.
- `src-tauri/tauri.conf.json` — explicitly select the normal `default` capability so E2E capability files are not implicitly included in release builds.
- `src/main.tsx` — later load `@wdio/tauri-plugin` only when the E2E frontend build flag is enabled.

## Implementation Tasks

### Task 0: Validate host prerequisites without changing the repository

**Files:**
- Modify: none

**Interfaces:**
- Produces a host that can run the repository's existing pnpm scripts and the external Tauri WebDriver path.

- [ ] **Step 1: Check the local runtime prerequisites**

  Verify Node.js, pnpm, Rust, `tauri-driver`, the Ubuntu WebKitGTK WebDriver package/executable, and `xvfb-run`. Confirm that the current WebKitGTK development library and the installed WebDriver use compatible package names and paths.

- [ ] **Step 2: Install only missing host prerequisites**

  Install a Node.js version compatible with the existing lockfile, the Ubuntu WebKitGTK WebDriver package available on this host, `tauri-driver`, and Xvfb where required. Do not install any repository dependency or edit repository files in this task.

- [ ] **Step 3: Verify the preconditions**

  Run the version/path checks again. Expected: Node and pnpm can execute `package.json` scripts; the WebKitGTK WebDriver and `tauri-driver` are discoverable; Xvfb is discoverable for the headless path.

### Task 1: Add WebdriverIO configuration and dependency scaffolding

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `wdio.conf.ts`

**Interfaces:**
- Consumes: `RUXEX_E2E_APP_BINARY` and `RUXEX_E2E_ARTIFACTS` environment variables from Task 2.
- Produces: a loadable WebdriverIO configuration with one Tauri capability using the external provider.

- [ ] **Step 1: Add the WebdriverIO development dependencies and scripts**

  Add the WebdriverIO CLI/runner/framework/reporter packages and `@wdio/tauri-service`, keeping all `@wdio/*` packages on one compatible major. Add scripts for running the normal and verbose E2E commands. Do not add `@wdio/tauri-plugin` or any Rust plugin in this task.

- [ ] **Step 2: Write the initial `wdio.conf.ts`**

  Configure `runner: "local"`, the `e2e/**/*.spec.ts` spec glob, the Mocha framework, `maxInstances: 1`, the `tauri` browser capability, and `driverProvider: "official"`. Resolve the application path from `RUXEX_E2E_APP_BINARY` with `target/debug/ruxex-desktop` as the repository-relative fallback. Keep log capture options disabled until Task 4.

- [ ] **Step 3: Validate configuration loading**

  Run the WebdriverIO config validation command. Expected: the config loads and resolves the Tauri service; it may still fail later if the debug binary or host driver has not been prepared.

### Task 2: Build the isolated E2E runner and Makefile entrypoints

**Files:**
- Create: `scripts/tauri_e2e_runner.py`
- Test: `scripts/test_tauri_e2e_runner.py`
- Modify: `Makefile`
- Modify: `.gitignore`

**Interfaces:**
- Produces `build_environment(base_env, home_dir, artifact_dir) -> dict[str, str]` with the E2E-only environment.
- Produces `build_wdio_command(spec: str | None) -> list[str]` for the repository-local WDIO invocation.
- Produces `run_e2e(headless: bool, spec: str | None) -> int` that preserves the child exit code and writes artifacts.

- [ ] **Step 1: Write unit tests for environment isolation and command construction**

  Assert that the environment builder sets `GDK_BACKEND=x11`, `RUXEX_PROVIDER=dummy`, `RUXEX_APP_SERVER_MODE=inprocess`, temporary `HOME`, and temporary `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME`. Assert that the command uses `pnpm exec wdio run wdio.conf.ts`, appends `--spec` only when requested, and wraps the command in `xvfb-run` only for the headless mode. Assert that safe environment metadata excludes credential-like variables.

- [ ] **Step 2: Run the runner unit tests and confirm the new behavior is absent**

  Run: `python3 -m unittest scripts.test_tauri_e2e_runner -v`

  Expected: FAIL because the runner module and its environment/command helpers do not exist yet.

- [ ] **Step 3: Implement the runner**

  Create the timestamped `artifacts/e2e/<run-id>/` directory, create temporary HOME/XDG directories, run the WebdriverIO command without a shell, write safe environment metadata and combined process output, preserve the child exit code, and clean up the temporary home after the run. Keep the artifact directory after success or failure. Do not recursively remove any path other than the explicitly created temporary directory.

- [ ] **Step 4: Add Makefile targets and ignore generated artifacts**

  Add `e2e-build`, `e2e`, and `e2e-headless`. `e2e-build` must create the debug Tauri binary through the supported Tauri CLI path and verify `target/debug/ruxex-desktop`. `e2e` invokes the runner with the Wayland/XWayland environment; `e2e-headless` invokes the same runner with Xvfb. Add `artifacts/e2e/` to `.gitignore`.

- [ ] **Step 5: Run the runner unit tests and preflight checks**

  Run the unit tests again and execute the runner with a deliberately invalid binary path or spec. Expected: the command returns non-zero, keeps the artifact directory, and writes the failure metadata without deleting unrelated files.

### Task 3: Add the first real-Tauri smoke spec and failure evidence hooks

**Files:**
- Create: `e2e/desktop-smoke.spec.ts`
- Modify: `wdio.conf.ts`

**Interfaces:**
- Consumes: the isolated environment and debug binary from Task 2.
- Produces: deterministic smoke coverage for app startup, main navigation, composer input, and send behavior.

- [ ] **Step 1: Write the smoke spec against the current accessible UI contract**

  Add tests that wait for the initial main-screen heading/landmark, locate the message input by its accessible label, enter a deterministic dummy-provider message, click the accessible Send control, and assert the resulting route or visible conversation state. Use one worker and explicit waits for asynchronous App Server state. Do not add network login or real credentials.

- [ ] **Step 2: Run the smoke spec before the debug binary exists**

  Run: `make e2e`

  Expected: FAIL at the binary/preflight stage with an actionable message, not with an opaque WebDriver timeout.

- [ ] **Step 3: Add failure artifact hooks**

  In `wdio.conf.ts`, add an `afterTest` hook that, only for failed tests, saves a WebView screenshot and page source under the run artifact directory. Artifact-write errors must be reported without replacing the original test failure. Use sanitized spec/test names for filenames.

- [ ] **Step 4: Build and run the real smoke test on Wayland/XWayland**

  Run: `make e2e`

  Expected: the debug binary launches through the external WebDriver provider, the smoke spec passes, and the run directory contains the normal execution log plus any failure evidence.

- [ ] **Step 5: Run the same spec under Xvfb**

  Run: `make e2e-headless`

  Expected: the same spec passes without depending on the physical Wayland desktop. Record any WebKitGTK/Xvfb-specific startup workaround in the README rather than hiding it in the test.

### Task 4: Add debug-only log forwarding and Tauri diagnostics

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/tauri.e2e.conf.json`
- Create: `src-tauri/capabilities/e2e.json`
- Modify: `src/main.tsx`
- Modify: `wdio.conf.ts`
- Create: `e2e/diagnostics.spec.ts`

**Interfaces:**
- Consumes: the external WebDriver runner and artifact directory from Tasks 1–3.
- Produces: debug-only `browser.tauri.execute()` and frontend/backend log forwarding.

- [ ] **Step 1: Write the plugin diagnostics spec and release-boundary checks**

  Add a diagnostics spec that verifies the Tauri plugin is available in the E2E build, executes a harmless JavaScript observation, and emits a deterministic frontend console marker. Add repository checks that assert the normal Tauri config selects only `default`, the E2E capability is separate, and the plugin registration is guarded by debug/test compilation.

- [ ] **Step 2: Run the diagnostics spec before plugin wiring**

  Run the diagnostics spec against the current E2E build. Expected: FAIL because the plugin API is not yet registered/imported.

- [ ] **Step 3: Add the debug-only Rust plugin dependency and registration**

  Add `tauri-plugin-wdio` under a debug-only dependency section and register it only under `#[cfg(debug_assertions)]` in the Tauri builder. Do not add `tauri-plugin-wdio-webdriver`; the external provider remains selected.

- [ ] **Step 4: Add the E2E-only Tauri config and capability**

  Make `tauri.conf.json` explicitly select `default`. Create `tauri.e2e.conf.json` that enables `withGlobalTauri` and selects `default` plus `e2e` for the debug E2E build. Create `e2e.json` with the minimum Linux `wdio` permissions needed for execute and log forwarding; do not grant unrelated filesystem, shell, or network permissions.

- [ ] **Step 5: Load the frontend plugin only in the E2E build**

  Add `@wdio/tauri-plugin` as a development dependency and load it from the frontend only when `VITE_E2E=1`. The normal Vite/release build must not include the test plugin import or test-only runtime behavior.

- [ ] **Step 6: Enable log forwarding and build the E2E binary**

  Enable `captureBackendLogs` and `captureFrontendLogs` in the E2E WebdriverIO service configuration with `info` as the default level. Build the E2E debug binary with `VITE_E2E=1` and the E2E config overlay. Preserve the existing debug-only App Server I/O output, which provides deterministic backend traffic for the diagnostics run.

- [ ] **Step 7: Run diagnostics and verify artifacts**

  Run the diagnostics spec and confirm the frontend marker, backend App Server I/O, Tauri execution result, and WebDriver output are visible in the run artifacts. If a WebKitGTK implementation does not support frontend `getLogs`, retain the backend/process logs and report the limitation rather than weakening the test silently.

- [ ] **Step 8: Verify the release boundary**

  Build the normal release configuration and inspect the selected capabilities and build output. Expected: no `wdio` capability is selected, no embedded WebDriver server is registered, and the test-only frontend plugin is not part of the normal build path.

### Task 5: Document the Codex loop and supported commands

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the final Makefile targets and artifact layout from Tasks 2–4.
- Produces: repository instructions that Codex can follow without guessing permissions or test entrypoints.

- [ ] **Step 1: Add the E2E workflow to AGENTS.md**

  Document when to run `make e2e`, when to run `make e2e-headless`, how to inspect `artifacts/e2e/`, that the dummy/in-process environment is isolated, and that release builds must not receive E2E permissions. Preserve the existing Makefile-first and unrelated-change rules.

- [ ] **Step 2: Add prerequisites and commands to README.md**

  Document Node.js/pnpm, Rust/Tauri, the Ubuntu WebKitGTK WebDriver package verification, `tauri-driver`, Xvfb, Wayland/XWayland behavior, and the distinction between WebView screenshots and desktop-wide screenshots. State that WebDriver does not operate OS dialogs or the GNOME desktop.

- [ ] **Step 3: Validate documentation commands**

  Run each documented command in the supported environment or mark host-dependent commands explicitly. Verify that no credential, machine-specific HOME path, or generated artifact is documented as a repository requirement.

### Task 6: Run the complete verification matrix

**Files:**
- Modify: none beyond the files owned by Tasks 1–5

**Interfaces:**
- Consumes: the completed E2E loop, diagnostics plugin, and documentation.
- Produces: evidence that the layered test contract and release boundary hold together.

- [ ] **Step 1: Run focused E2E checks**

  Run the launch/navigation smoke spec and diagnostics spec individually through `make e2e` and `make e2e-headless`.

- [ ] **Step 2: Run existing repository checks**

  Run `make check-tests`, `make rust-test`, `make package-test`, and `make build`. Resolve only failures caused by this feature and report unrelated failures separately.

- [ ] **Step 3: Run the supported aggregate verification**

  Run `make verify` after the focused checks. Confirm that the E2E artifact directory remains ignored and that no staged runtime package or generated local state enters Git.

- [ ] **Step 4: Review the final diff and boundary**

  Run `git diff --check`, inspect the complete diff, confirm that the background changes in `src-tauri/src/app_server.rs` and `src-tauri/src/desktop.rs` remain intact, and verify that the release capability selection still excludes E2E permissions.

## Deferred or Explicitly Excluded Work

- Embedded WebDriver remains a future alternative if external Linux driver management becomes a cross-platform maintenance problem.
- Desktop-wide Computer Use, GNOME UI, OS dialogs, and global shortcut automation require a separate desktop automation design.
- Visual regression baselines are not part of this implementation; screenshots remain diagnostic artifacts.
- No implementation, dependency installation, build, or test execution is performed as part of writing this plan.
