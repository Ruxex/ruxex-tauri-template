---
name: ruxex-tauri-agent-verification
description: Use when a Ruxex UI, Tauri, WebView, IPC, or App Server change needs post-task verification in the real desktop app on Ubuntu.
---

# Ruxex Tauri Agent Verification

Use the real Tauri app as an exploratory verification target when an implemented
change can affect visible UI, navigation, IPC, App Server behavior, or rendering.
This is an agent operation loop; preserve a scenario as a permanent E2E test only
when it is a useful regression or reproducibility contract.

## Completion trigger

After completing a UI/Tauri/App Server task, decide whether real-app observation
is useful. If it is, perform the smallest relevant interaction before reporting
completion. Observation is need-based: use visible state and command results
first, then add snapshots, screenshots, source, or logs when they answer the
specific debugging question.

## Constraints

- Use WebdriverIO v10 `wdio session` through `wdio.tauri.conf.mjs`.
- Do not use `@wdio/tauri-service` or `wdio session open tauri` for this loop.
- Use the existing external `tauri-driver` and Linux `WebKitWebDriver`.
- Use a temporary `HOME`, `RUXEX_HOME`, and XDG directories when the app can
  touch provider state. Never send a real provider/API request.
- Keep test-only permissions, diagnostics plugins, and global Tauri access out
  of release capabilities.

## Persistent session loop

Start `tauri-driver` in a long-lived terminal or tmux pane. Use
`--native-driver` when `WebKitWebDriver` is not on PATH:

```bash
tauri-driver --port 4444 --native-driver /path/to/WebKitWebDriver
```

In another shell, open the session once. The debug binary path is resolved by
the repository config and can be overridden:

```bash
RUXEX_SESSION_APP_BINARY=target/debug/ruxex-desktop \
pnpm exec wdio session open ./wdio.tauri.conf.mjs 0 \
  --idle-timeout 0 --session ruxex
```

The command returns while the Tauri process and WDIO session remain alive.
Continue from independent shells, using refs from the latest snapshot:

```bash
pnpm exec wdio session status --session ruxex
pnpm exec wdio session snapshot --interactive --session ruxex
pnpm exec wdio session click <ref> --session ruxex
pnpm exec wdio session fill <ref> "text" --session ruxex
pnpm exec wdio session diff --session ruxex
pnpm exec wdio session screenshot --session ruxex
pnpm exec wdio session info --session ruxex
```

Finish with:

```bash
pnpm exec wdio session close --session ruxex
```

Then stop the `tauri-driver` process in its owning terminal. Never use a broad
process kill because another session may use a different port.

## Linux compatibility

`wdio.tauri.conf.mjs` enforces classic WebDriver. In the current Ubuntu
WebKitWebDriver, adding `--no-bidi` causes `Failed to match capabilities`
because the driver rejects `webSocketUrl: false`; omit that flag while keeping
`wdio:enforceWebDriverClassic: true`. A different driver may accept the flag.
If the error mentions a missing WebKit driver, install the distro package or
pass its executable with `--native-driver`.

`browser.tauri.execute()` and automatic frontend/backend log forwarding belong
to a separate diagnostics-plugin path. They are optional observations, not a
requirement for this service-free session.
