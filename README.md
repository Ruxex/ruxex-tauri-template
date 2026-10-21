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

## Development

```sh
pnpm install
pnpm check
pnpm test
python3 scripts/test_stage_ruxex_package.py
pnpm tauri dev
```

ブラウザ上でモックApp Serverに接続したUI全体を確認する場合は、次を実行します。

```sh
make mock-app-server
```

このモードでは `VITE_MOCK_APP_SERVER=1` が有効になり、Tauriのinvoke/eventブリッジと
基本的なApp Server応答がインメモリで置き換えられます。

The existing Tauri configuration expects the staged package at
`src-tauri/resources/ruxex-package` before creating a distributable build.

## License and provenance

Ruxex is derived from Codex and retains the applicable copyright, license,
third-party, and upstream notices. See [NOTICE](NOTICE) and [LICENSE](LICENSE).
