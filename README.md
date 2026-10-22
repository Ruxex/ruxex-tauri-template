# Ruxex Tauri Template

This repository is a customizable Tauri and React starting point for building
a Ruxex application. It provides the App Server bridge, typed protocol
helpers, React hooks, and a working reference UI while leaving the Tauri
builder, windows, commands, routes, and visual design in your control.

## What you customize

- Implement your model provider in the Rust application.
- Provide your product identity and brand settings.
- Replace the files under `src/` with your own React, Vue, Svelte, or other
  web UI.
- Add your own Tauri commands, windows, menus, permissions, and packaging.

The code under `src/app-server/` is intentionally headless apart from the
Tauri transport. It includes typed requests and responses, event handling,
thread and turn hooks, project hooks, provider queries, and approval state.
Use it as-is or adapt it to your own frontend architecture.

The TypeScript App Server protocol is checked into `src/protocol/generated/`
as the snapshot matching the pinned Ruxex revision, so a clone does not need a
sibling Ruxex checkout for frontend typechecking.

## Workbench data boundary

The reference UI is a three-region workbench: projects and threads on the
left, the conversation and composer in the center, and Activity, Changes, or
Context on the right. Its activity cards use typed App Server thread-item and
event data, including messages, plans, reasoning, commands, file changes, MCP
calls, and agent collaboration.

Thread history, projects, goals, attachments, queued turns, approvals, model
selection, and runtime state are never invented or persisted by the frontend.
They are read from and changed through the App Server protocol. The only
client-local persistence is versioned presentation state such as theme,
density, and panel visibility, stored in browser/Tauri local storage under
`ruxex.ui-preferences`. Unknown future protocol items are shown as collapsed
activity details so the UI remains inspectable without guessing their meaning.

## Prerequisites

- Rust and Cargo from the Ruxex toolchain
- Node.js and pnpm
- Tauri's platform prerequisites
- Python 3 for runtime-package staging tests

The Rust dependencies currently use a pinned Git revision of the Ruxex
repository while the public integration boundary is being finalized. The
template does not require a sibling Ruxex checkout.

## Runtime package

The Tauri application bundles a platform-specific `ruxex-package` containing
the Ruxex executable, the code-mode host, ripgrep, and the platform sandbox
helper where applicable. This template repository does not include or publish
platform-specific runtime binaries or Rusty V8 artifacts; staging is an
explicit local or CI input.

Stage those files with `scripts/stage-ruxex-package.py`, passing the paths to
the built Ruxex executable and code-mode host plus `rg` and, on Linux,
`bwrap`. The staged directory is intentionally ignored by Git.

## Capability boundary

The reference application currently provides server-backed thread history,
projects, queue and goal controls, approval requests, image input, Markdown
and code/diff rendering, inline review startup, MCP status/reload, Skills,
Plugins, collaboration-mode inventory, and a typed local/remote App Server
connection UI.

The four desktop capability boundaries are implemented behind explicit
protocol and platform adapters:

- Browser/Computer Use reads `config/read` and `configRequirements/read`, keeps
  the App Server authoritative for execution and approvals, presents dynamic
  tool images and `imageView` screenshots, and opens validated HTTP(S) URLs.
- Native notifications cover completed turns, pending server requests, and
  disconnects, with permission, duplicate, and focused-window suppression.
  `ruxex://thread/<id>` and `ruxex://project/<id>` deep links are normalized
  before navigation.
- Schedules are persisted under the Desktop Ruxex home, support one-shot,
  daily, and weekly cadence, retain failed runs, and can start or resume a
  thread through the active local or remote App Server connection.
- Native Git worktree commands list, create, open, and remove worktrees with
  repository-root, branch, and dirty-removal checks. Dirty removal requires
  an explicit force action.

Artifact viewers and signed Linux/macOS release artifacts remain outside this
template's scope.

## Development

```sh
make install
make check-tests
make package-test
make rust-test
make build
make run
```

ブラウザ上でモックApp Serverに接続したUI全体を確認する場合は、次を実行します。

```sh
make mock-app-server
```

このモードでは `VITE_MOCK_APP_SERVER=1` が有効になり、Tauriのinvoke/eventブリッジと
基本的なApp Server応答がインメモリで置き換えられます。

The `Makefile` is the supported local verification entrypoint. `make
check-tests` runs the frontend type and lint checks plus the Vitest suite;
`make package-test` validates runtime-package staging; `make rust-test` runs
the Tauri bridge tests; `make verify` runs all checks and the frontend build;
and `make run` starts the Tauri development application.

The existing Tauri configuration expects the staged package at
`src-tauri/resources/ruxex-package` before creating a distributable build.

## License and provenance

Ruxex is derived from Codex and retains the applicable copyright, license,
third-party, and upstream notices. See [NOTICE](NOTICE) and [LICENSE](LICENSE).
