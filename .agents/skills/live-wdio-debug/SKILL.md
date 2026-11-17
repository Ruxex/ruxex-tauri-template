---
name: live-wdio-debug
description: Use when reproducing or investigating a UI symptom in the live Ruxex Tauri app through a persistent WebdriverIO session, especially when each action must be observed before the next.
---

# Live WDIO Debug

Use this workflow to inspect the live Tauri WebView and reproduce UI symptoms
with WebdriverIO v10. Keep the app session alive while issuing separate WDIO
commands, so each action can be checked against the state that follows it.

## Launch and connect

Run the commands below from the `ruxex-tauri-template` repository root.

Use the existing service-free setup:

- `tauri-driver` and Linux `WebKitWebDriver` run outside WDIO.
- `wdio session open` starts the configured debug application and creates a
  persistent session. It returns while the app and session remain alive.
- Later `wdio session ... --session <id>` commands reconnect to that session.

This reconnects to a WDIO session created by `session open`; it does not attach
to an arbitrary Tauri process that was already running.

Use a debug binary built from the code under investigation. The default
application is `target/debug/ruxex-desktop`; set `RUXEX_SESSION_APP_BINARY` to
select another binary. If it is missing or stale, follow the repository's
documented Tauri debug-build procedure; `make build` builds only the frontend.

In a dedicated terminal, start the driver and leave it running. When the app
might touch provider state, use temporary `HOME`, `RUXEX_HOME`, and `XDG_*`
directories in this driver's environment so the launched app inherits them.
Keep the normal display environment available:

```bash
debug_home="$(mktemp -d)"
mkdir -p "$debug_home"/{home,ruxex,config,data,cache,state}
env HOME="$debug_home/home" \
  RUXEX_HOME="$debug_home/ruxex" \
  XDG_CONFIG_HOME="$debug_home/config" \
  XDG_DATA_HOME="$debug_home/data" \
  XDG_CACHE_HOME="$debug_home/cache" \
  XDG_STATE_HOME="$debug_home/state" \
  tauri-driver --port 4444 --native-driver /path/to/WebKitWebDriver
```

If `WebKitWebDriver` is already on `PATH`, omit `--native-driver`. In another
shell, open one persistent session:

```bash
RUXEX_SESSION_APP_BINARY=target/debug/ruxex-desktop \
pnpm exec wdio session open ./wdio.tauri.conf.mjs 0 \
  --idle-timeout 0 --session ruxex-debug
```

The configured driver endpoint defaults to `127.0.0.1:4444`. For another
port, pass it to `tauri-driver --port` and set `WDIO_TAURI_DRIVER_PORT` to the
same value for `session open`.

This workflow does not authorize real provider or API requests. If a task
explicitly requires a real-provider smoke test, follow the separate
[real-provider-smoke-test.md](../../../docs/real-provider-smoke-test.md),
including its credential, user-home, and cost requirements. Otherwise use an
approved local fixture and report any behavior that cannot be reproduced
without a real request.

## Observe one step at a time

Use this loop for every state-changing operation:

1. Read the current state with `status` and an interactive snapshot.
2. Choose one control or input from that latest snapshot.
3. Run exactly one `click` or `fill` command.
4. Read the resulting state with a new snapshot; use `diff` when it helps show
   what changed.
5. Decide the next action from that new observation.

Run each command below separately, inspect its output, then choose the next
command. Do not send an action and its follow-up observation as one batch.

```bash
pnpm exec wdio session status --session ruxex-debug
pnpm exec wdio session snapshot --interactive --session ruxex-debug
pnpm exec wdio session click <ref-from-latest-snapshot> --session ruxex-debug
pnpm exec wdio session snapshot --interactive --session ruxex-debug
```

For text entry, use one `fill` command, then take a new snapshot before
submitting:

```bash
pnpm exec wdio session fill <fresh-ref> "text" --session ruxex-debug
pnpm exec wdio session snapshot --interactive --session ruxex-debug
```

Snapshot references can become stale after navigation or rendering changes.
Always use a reference from the latest snapshot. If a command errors or its
result is ambiguous, inspect the current state before retrying so an action is
not accidentally performed twice. For transient behavior, take successive
observations and distinguish intermediate state from a settled result; do not
infer that the app is ready from a single partial snapshot.

Each snapshot and screenshot is a separate observation; they are not an atomic
capture of the same instant. A WebView snapshot does not establish App Server
or backend state. Use `diff` only when its comparison baseline is clear, and
prefer the current snapshot as the primary evidence.

Use screenshots when the symptom is visual and a DOM snapshot cannot establish
the rendered appearance:

```bash
pnpm exec wdio session screenshot --session ruxex-debug
```

This session observes the app's WebView. It does not operate native OS dialogs
or establish desktop-wide state. Use `info` for session details, and do not use
the diagnostics plugin or JavaScript execution as a substitute for this
stepwise observation loop.

## Finish the observation

Close only the session created for this task, then stop the `tauri-driver`
process in the terminal where it was started:

```bash
pnpm exec wdio session close --session ruxex-debug
```

After stopping the driver, remove the temporary directory created for this
session, if one was created.

Do not use a broad process kill; another task may own a different session or
driver. Record the command results relevant to the symptom in the task notes,
and state which details were observed versus inferred.
