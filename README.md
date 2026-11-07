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

For the Linux Tauri E2E loop, also install or make available:

- `tauri-driver`
- the WebKitGTK WebDriver executable (`WebKitWebDriver`)
- `xvfb-run` for headless runs

The runner performs preflight checks and fails with the missing executable's
name. On a Wayland desktop it sets `GDK_BACKEND=x11` and uses the existing
XWayland display. The headless target uses a private Xvfb display instead.

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
remote or paid model by itself. Set `CLOUDFLARE_MODEL` to restrict the model
catalog to one model and force chat requests to use that model.

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

## Tauri agent E2E

The repository provides an external WebDriver loop for the real Tauri binary:

```sh
make e2e-build
make e2e
make e2e-headless
```

`make e2e` drives the WebView through accessible roles and names, using a
temporary HOME and the local dummy provider. It does not log in, call a model
provider, or use the developer's Ruxex home. Failed tests keep screenshots and
page source under `artifacts/e2e/`.

For diagnostics and log forwarding, use the separate debug-only path:

```sh
make e2e-diagnostics
make e2e-diagnostics-headless
```

This path enables `tauri-plugin-wdio`, `browser.tauri.execute()`, and frontend
and backend log forwarding only in the E2E debug binary. The normal smoke
binary intentionally omits the frontend invoke instrumentation because the
WebKitGTK implementation can otherwise affect the App Server invoke flow.
The normal capability remains `default`; the E2E capability and global Tauri
API are selected only by `src-tauri/tauri.e2e.conf.json`.

WebDriver observes and operates the Tauri WebView. It does not automate GNOME,
other applications, OS file choosers, title bars, notifications, or global
shortcuts. Screenshots saved by the E2E hook are WebView screenshots, not
desktop-wide captures.

### DummyProvider UI fixture home

For repeatable UI design checks, run the single fixture target. It builds the
debug app once, recreates the persistent DummyProvider catalog, captures the
stable pages, captures the volatile event states, and captures the real
Marketplace states:

```sh
make ui-fixtures
```

The generated home is `.d/` and is intentionally not committed. The default
persistent catalog contains 14 threads: 12 active and 2 archived, across
three rootless projects with 2, 1, and 0 project threads. Re-running the
command resets and rebuilds that catalog, so its counts remain deterministic.

This headful run captures six screenshots: pending approval, pending user
input, pending permissions, slow streaming, queued message, and disconnect
recovery. Pending request cards and in-progress streams live only in memory;
they are recreated by this WDIO operation set and are not restored from the
database. The complete target intentionally leaves those volatile conversations
in `.d/` for manual UI inspection after the run.

This captures 15 screenshots covering the home, thread/archive/project pages,
all settings sections, Automation, Approval center, and one project detail
page. The screenshots are written to the ignored `artifacts/e2e/` run
directory and the prepared home is preserved in `.d/`.

### Real plugin marketplace fixture home

For Marketplace and plugin UI screenshots, the complete `make ui-fixtures`
target uses the real sibling checkout at `../../openai-plugins` relative to
this repository root:

```sh
make ui-fixtures
```

The WDIO fixture stores only that relative path in tracked source, resolves it
to an absolute path at runtime, and adds it through the normal Marketplace
settings UI. The generated home is `.m/` and is intentionally ignored. The
Marketplace checkout is not copied into this repository; plugin installation
is still performed by the App Server into the generated home, matching the
real application flow.

The run covers the empty Marketplace state, the real `openai-curated` list,
an uninstalled Notion detail page, and an installed Build Web Apps state. The
five screenshots are saved under the ignored `artifacts/e2e/` run directory:
`marketplace-empty.png`, `marketplace-list.png`,
`marketplace-notion-detail.png`, `marketplace-installed-list.png`, and
`marketplace-build-web-apps-detail.png`.

For an exploratory smoke test against a real provider and LLM, see
[Real provider smoke test](docs/real-provider-smoke-test.md). It uses the
persistent WDIO session and covers authentication, model discovery, streaming,
tool approval, denial, multi-turn history, and session continuity.

## License and provenance

Ruxex is derived from Codex and retains the applicable copyright, license,
third-party, and upstream notices. See [NOTICE](NOTICE) and [LICENSE](LICENSE).
