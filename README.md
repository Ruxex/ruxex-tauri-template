# Ruxex Tauri Template

This repository is a customizable Tauri and React starting point for building
a Ruxex application. It provides the App Server bridge, typed protocol
helpers, React hooks, and a working reference UI while leaving the Tauri
builder, windows, commands, routes, and visual design in your control.

## What you customize

- Implement your model provider in the Rust application.
- Provide your product identity and brand settings through `DesktopConfig`.
- Replace the files under `src/` with your own React, Vue, Svelte, or other
  web UI.
- Add your own Tauri commands, windows, menus, permissions, and packaging.

The code under `src/app-server/` is intentionally headless apart from the
Tauri transport. It includes typed requests and responses, event handling,
thread and turn hooks, project hooks, provider queries, and approval state.
Use it as-is or adapt it to your own frontend architecture.

The TypeScript App Server protocol is checked into `src/protocol/generated/`
as the snapshot matching the pinned Ruxex v0.4.10 revision, so a clone does not
need a sibling Ruxex checkout for frontend typechecking.

## Inject branding, provider, and home name

Replace the template's `src-tauri/src/main.rs` with a small composition root.
The library-facing Rust entrypoints accept one typed configuration. The home
value is a directory name resolved below the current user's `~/`; it is not an
absolute path.

```rust
use ruxex_desktop_lib::DesktopConfig;

fn desktop_config() -> DesktopConfig {
    DesktopConfig::builder(my_provider::provider_factory())
        .app_name("Acme")
        .assistant_name("Acme Assistant")
        .window_title("Acme Desktop")
        .product_slug("acme-desktop")
        .home_dir_name(".acme_desktop")
        .home_marker_file("acme-home.json")
        .build()
}

fn main() {
    let config = desktop_config();
    let is_app_server_daemon = std::env::args_os().any(|arg| {
        arg == ruxex::desktop::daemon::HOST_APP_SERVER_DAEMON_MODE_ARG
    });

    if is_app_server_daemon {
        ruxex_desktop_lib::run_host_app_server_daemon_with_config(config)
            .expect("provider daemon failed");
    } else {
        ruxex_desktop_lib::run_with_config(config);
    }
}
```

`desktop_config()` is intentionally called in both modes. The hidden daemon
is a separate process, so it must receive the same provider factory, branding,
and Home directory name as the Tauri process.

If only the provider is customized, the branding defaults can be kept:

```rust
fn desktop_config() -> ruxex_desktop_lib::DesktopConfig {
    ruxex_desktop_lib::DesktopConfig::builder(my_provider::provider_factory()).build()
}
```

When no customization is needed, `run()` uses the template's default Ruxex
configuration. Updating the `ruxex` Cargo dependency then keeps the provider
and runtime integration in the library boundary while this small composition
root remains stable.

## Workbench data boundary

The reference UI is a two-region workbench: projects and threads on the left,
and the conversation and composer in the center. Its activity cards use typed
App Server thread-item and event data, including messages, plans, reasoning,
commands, file changes, MCP calls, and agent collaboration.

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

The example Rust dependencies use the sibling Ruxex checkout at `../ruxex`,
including its provider-host sample. For a distributable application, replace
the Ruxex path dependency with the published release you intend to ship and
replace the `publish = false` provider-host sample with your own provider-host
crate (published or kept in your application workspace).

## Runtime package

The Tauri application bundles a platform-specific `ruxex-package` containing
the Ruxex executable, the code-mode host, ripgrep, and the platform sandbox
helper where applicable. This template repository does not include or publish
platform-specific runtime binaries or Rusty V8 artifacts; staging is an
explicit local or CI input.

Stage those files with `scripts/stage-ruxex-package.py`, passing the paths to
the built Ruxex executable and code-mode host plus `rg` and, on Linux,
`bwrap`. The staged directory is intentionally ignored by Git.

## App Server runtime mode

The Tauri application selects its local App Server mode from the
`RUXEX_APP_SERVER_MODE` environment variable at launch:

```sh
RUXEX_APP_SERVER_MODE=daemon pnpm tauri dev
RUXEX_APP_SERVER_MODE=inprocess pnpm tauri dev
```

The default is `daemon`, which keeps the managed App Server lifecycle controls
in Settings. `inprocess` embeds the App Server in the Tauri process; Settings
shows `InProcess mode` and hides the daemon PID, socket, and Start/Restart/Stop
controls. The mode is selected at startup and cannot be changed while the app
is running.

## Local provider-host development

The template's example build uses the sibling checkout at `../ruxex` for
the Ruxex and provider-host dependencies. It selects the dummy provider by
default. Set `RUXEX_PROVIDER=cloudflare` to use the existing Cloudflare
provider implementation from that checkout; credentials are still required
before making a model request.

For a local in-process launch with that provider, run:

```sh
make local-cloudflare-inprocess
```

This target only changes the local process configuration. It does not select a
remote or paid model by itself.

## Capability boundary

The reference application currently provides server-backed thread history,
projects, queue and goal controls, approval requests, image input, Markdown
and code/diff rendering, inline review startup, MCP status/reload, Skills,
Plugins, collaboration-mode inventory, and a typed local/remote App Server
connection UI.

### Plugin compatibility philosophy

Ruxex is provider-neutral and does not depend on OpenAI's registered Connected
Apps or Connector IDs. Its plugin target is the open, community-oriented
surface: Skills, standard MCP servers, MCP OAuth, hooks, scripts, local tools,
and marketplace metadata. A community plugin should be usable in Ruxex when it
uses those portable surfaces; provider-specific hosted App registrations are
intentionally outside the compatibility promise.

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
