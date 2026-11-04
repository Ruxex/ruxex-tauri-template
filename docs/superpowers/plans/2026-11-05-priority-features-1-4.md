# Priority Desktop Features 1–4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved local-first Ruxex desktop priorities in order: global panel, BrowserController boundary, plugin connection UX, and local multi-agent controls, while stopping an individual priority when the existing App Server contract is insufficient.

**Architecture:** Keep App Server authoritative for threads, OAuth, MCP state, collaboration modes, and agent events. Add desktop-only presentation and native window behavior in Tauri/React, reusing existing typed protocol hooks. A BrowserController driver is deliberately not invented in the desktop client; the browser task ends with an evidence-backed protocol boundary when the App Server has no executable driver contract.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, React Router, TanStack Query, Vitest, existing Ruxex App Server protocol, Playwright-compatible browser boundary.

**Spec:** `docs/ruxex-product-direction-memo.md`

## Global Constraints

- Cloud execution is out of scope; browser, agent, file, artifact, and credential flows remain local-first.
- OpenAI proprietary Connected Apps and Connector IDs are out of scope; use community Plugin, MCP, OAuth, and Marketplace contracts.
- App Server remains authoritative for server-backed state; the desktop client must not invent credential storage, OAuth completion, or agent lifecycle state.
- Use the existing Tauri native command and OS default browser for OAuth authorization URLs.
- Do not edit generated protocol files by hand.
- Follow the repository validation commands: `make check-tests`, `make rust-test`, and `git diff --check` as applicable.

## Review Focus

- Shortcut invocation while the main window is hidden: the quick panel must be created, shown, focused, and reusable without opening a second main session. Covered by the native quick-panel tests.
- Quick-panel image/audio cancellation and unsupported browser media APIs: the panel must remain usable and send only the inputs the user actually captured. Covered by `QuickPanelPage` tests.
- OAuth login failure or an empty authorization URL: the UI must show an actionable error and never call the native browser opener with an invalid URL. Covered by Capabilities page tests.
- OAuth status values that are not logged in, bearer-token based, or unknown: the UI must describe the state without pretending that a missing App Server logout/scope API exists. Covered by connection-status tests.
- Collaboration presets with null mode/model metadata: the composer must not send malformed `collaborationMode` data. Covered by composer and hook tests.

---

### Task 1: Global Quick Panel

**Files:**
- Create: `src-tauri/src/quick_panel.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src/components/quick-panel/QuickPanelPage.tsx`
- Create: `src/components/quick-panel/QuickPanelPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/platform/native.ts`
- Modify: `package.json` and `pnpm-lock.yaml` only if the selected Tauri plugin requires a frontend package

**Interfaces:**
- Produces a Tauri window labeled `quick-panel`, opened by a registered `CmdOrCtrl+Shift+Space` shortcut.
- Produces a React route `/quick-panel` with short text input, OS display capture, image attachment, MediaRecorder audio capture, and new-thread send behavior.
- Uses existing `thread/start` and `turn/start` hooks; audio is sent as `UserInput { type: "audio", url }` and images as existing data-URL image inputs.

- [ ] **Step 1: Write failing native and UI tests**
  - Add Rust unit tests for the stable panel label, default shortcut, and URL route fragment.
  - Add `QuickPanelPage` tests for text-only send, image inclusion, audio inclusion, capture cancellation, and missing `MediaRecorder` handling.
- [ ] **Step 2: Run the focused tests and verify they fail**
  - Run `pnpm test -- src/components/quick-panel/QuickPanelPage.test.tsx`.
  - Run `cargo test --locked --manifest-path src-tauri/Cargo.toml quick_panel`.
  - Expected: the new module, route, and native constants are not implemented.
- [ ] **Step 3: Implement the native panel**
  - Add the Tauri global-shortcut plugin at the version compatible with the repository’s Tauri 2 pins.
  - Register the shortcut during setup and create/show/focus the `quick-panel` Webview window on demand.
  - Make the panel a compact always-on-top window and make close destroy or hide only that panel, never the main window.
  - Keep the shortcut constant centralized so a later settings surface can replace it without changing the event handler.
- [ ] **Step 4: Implement the React panel**
  - Add a top-level `/quick-panel` route outside `AppLayout`.
  - Use `thread/start` followed by `turn/start` for a new local thread; keep the UI intentionally short and close the panel after a successful send.
  - Implement display capture through `navigator.mediaDevices.getDisplayMedia` and a canvas snapshot, stopping tracks in every success/cancel path.
  - Implement microphone capture through `MediaRecorder`, stop tracks on unmount, and convert the recorded Blob to a data URL before sending.
  - Reuse existing image attachment validation and report unsupported capture APIs as non-fatal UI errors.
- [ ] **Step 5: Run focused tests and repository checks**
  - Run the focused Vitest and Rust tests, then `make check-tests`, `make rust-test`, and `git diff --check`.
- [ ] **Step 6: Commit**
  - Commit as `feat(desktop): add global quick panel`.

### Task 2: BrowserController Boundary Audit

**Files:**
- Create: `docs/superpowers/notes/2026-11-05-browsercontroller-boundary.md`
- Test: no production test; this task is a protocol-gated stop point

**Interfaces:**
- Consumes the existing `config/read`, `configRequirements/read`, `thread/start.dynamicTools`, `item/tool/call`, image result, and approval request contracts.
- Produces a short evidence record stating whether the current App Server exposes an executable BrowserController/managed-Chromium driver contract.

- [ ] **Step 1: Inspect the generated protocol and existing client adapters**
  - Confirm whether a typed browser open/snapshot/click/fill/press/screenshot/download contract, browser process lifecycle, and browser-specific approval request exist.
- [ ] **Step 2: Add the audit note**
  - Record the existing browser/computer-use capability/configuration fields and dynamic-tool/approval insertion points.
  - Record the missing executable driver/lifecycle contract if, as expected, only capability metadata and generic tool plumbing exist.
- [ ] **Step 3: Stop this priority if App Server support is missing**
  - Do not add a fake Playwright sidecar protocol or browser state in the desktop client.
  - Continue to Task 3, as authorized by the user.

### Task 3: Plugin Connection UX

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/CapabilitiesPage.test.tsx`
- Modify: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Modify: `src/platform/native.test.ts` if native opener coverage is needed
- Create: `docs/superpowers/notes/2026-11-05-plugin-connection-boundary.md`

**Interfaces:**
- Consumes existing `mcpServerStatus/list`, `mcpServer/oauth/login`, `McpAuthStatus`, and `open_browser_window` contracts.
- Produces Connect/Re-authenticate actions, OAuth/auth-state presentation, and a documented stop point for missing App Server logout and scope catalog methods.

- [ ] **Step 1: Write failing tests**
  - Assert that `notLoggedIn` renders `Connect`, calls `mcpServer/oauth/login`, and opens the returned authorization URL.
  - Assert that a missing/invalid authorization URL renders an error and does not invoke the native opener.
  - Assert that `oAuth`, `bearerToken`, and `unknown` states are labeled distinctly.
- [ ] **Step 2: Run the focused tests and verify they fail**
  - Run `pnpm test -- src/pages/CapabilitiesPage.test.tsx src/app-server/hooks/useCapabilityQueries.test.tsx`.
- [ ] **Step 3: Implement supported connection UX**
  - Add a Connect action for `notLoggedIn`, a Re-authenticate action for OAuth-backed status, and clear bearer-token/unknown status text.
  - Call the existing OAuth mutation, validate `authorizationUrl`, then call `openBrowserWindow` only for `http`/`https` URLs.
  - Keep server invalidation and OAuth completion notification behavior in the existing hook; do not duplicate credential persistence in the UI.
- [ ] **Step 4: Verify the App Server gap and document it**
  - Confirm generated requests contain no `mcpServer/oauth/logout`, connection deletion, account list, or scope discovery contract.
  - Do not implement a fake Disconnect or guessed scope catalog. Record that the rest of Task 3 is blocked on an App Server API and continue.
- [ ] **Step 5: Run focused tests and repository checks**
  - Run `make check-tests` and `git diff --check`.
- [ ] **Step 6: Commit**
  - Commit as `feat(desktop): add MCP connection actions`.

### Task 4: Local Multi-Agent Controls

**Files:**
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`
- Modify: `src/app-server/hooks/index.ts`
- Modify: `src/components/conversation/ComposerSettings.tsx`
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/Composer.test.tsx`
- Modify: `src/components/chat/NewChatComposer.tsx`
- Modify: `src/components/conversation/conversation-model.ts` only if agent activity labels need clarification
- Create: `docs/superpowers/notes/2026-11-05-multi-agent-boundary.md`

**Interfaces:**
- Consumes existing `collaborationMode/list`, `turn/start.collaborationMode`, `thread/settings/update.collaborationMode`, `thread/fork`, `collabAgentToolCall`, and `subAgentActivity` contracts.
- Produces a collaboration-preset selector, correctly shaped turn/settings payloads, and a `useForkThread` mutation for local coordinator workflows.

- [ ] **Step 1: Write failing hook and UI tests**
  - Assert `useForkThread` maps to `thread/fork` and returns the server response.
  - Assert selecting a valid collaboration preset sends `mode`, `model`, `reasoning_effort`, and `developer_instructions` with the next turn/settings update.
  - Assert null mode/model presets are rendered but never produce malformed collaboration payloads.
- [ ] **Step 2: Run the focused tests and verify they fail**
  - Run `pnpm test -- src/app-server/hooks/useThreadMutations.test.tsx src/components/conversation/Composer.test.tsx`.
- [ ] **Step 3: Implement protocol-backed local controls**
  - Add `useForkThread` with the same cache/session conventions as `useCreateThread`.
  - Load collaboration presets through `useCollaborationModes`, add a compact selector to composer settings, and derive a `v2.CollaborationMode` only when all required fields are valid.
  - Include the selected mode in `turn/start` and persist it through `thread/settings/update` when the user changes it.
  - Keep the existing collaboration activity aggregation visible and label child-agent activity clearly.
- [ ] **Step 4: Verify the remaining multi-agent boundary**
  - Confirm no typed client requests exist for explicit sub-agent stop/resume/cancel, coordinator activity aggregation API, per-agent resource limits, or review-gate adoption.
  - Document that proactive multi-agent execution and event display are supported by the existing protocol, while the missing lifecycle/resource/review controls require App Server support; do not invent local shadow state.
- [ ] **Step 5: Run focused tests and repository checks**
  - Run `make check-tests`, `make rust-test`, and `git diff --check`.
- [ ] **Step 6: Commit**
  - Commit as `feat(desktop): expose local collaboration controls`.

## Final Verification

- [ ] Run `make verify` from `ruxex-tauri-template`.
- [ ] Inspect `git diff --check` and `git status --short` to ensure unrelated user changes remain intact.
- [ ] Report implemented items and the exact App Server-gated stop points for Tasks 2–4.
