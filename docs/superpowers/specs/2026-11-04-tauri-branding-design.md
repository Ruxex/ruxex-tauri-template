# Tauri template branding design

## Intent

Keep the template's default user-facing identity as Ruxex while making a
rebrand a one-file change. Product names, visible assistant labels, native
application metadata, and user-data identity must not drift apart.

## Goals

- Make `src-tauri/src/branding.rs` the single typed runtime branding source.
- Allow a library consumer to inject branding and its provider factory through
  one Rust `DesktopConfig` value.
- Reuse the values in the React UI, Rust `ProductIdentity`, and App Server.
- Preserve internal Ruxex protocol names, runtime package paths, storage keys,
  and compatibility identifiers unless they are explicitly part of the
  configurable product identity.

## Non-goals and anti-goals

- Do not rename generated protocol types or external wire fields.
- Do not migrate existing user data when a consumer changes branding; the
  configured home directory remains the consumer's responsibility.
- Do not replace dynamic server/provider/project names with the application
  brand.
- Do not make the Tauri template depend on a second hand-maintained branding
  value in frontend or Rust source.

## Approaches

1. Separate typed branding constants in TypeScript and Rust: rejected because
   every rebrand would require coordinated edits in two languages.
2. Keep branding in `tauri.conf.json`: rejected because the JSON is not the
   shared typed source for the React UI and Rust product identity.
3. Keep one Rust-owned typed value and expose only its UI fields to React:
   selected because the runtime, provider host, and data directory all share
   the same composition root.

## Design

`src-tauri/src/branding.rs` contains the configurable product identity:

- product and desktop display names;
- assistant display name used in composer and conversation labels;
- product slug;
- home directory and marker file names.

Rust owns a typed `Branding` value and `DesktopConfig` composes it with the
provider runtime factory. A consumer can construct `DesktopConfig::new(...)`
from outside the template and pass it to `run_with_config` and
`run_host_app_server_daemon_with_config`. The Tauri command `get_branding`
returns the serializable UI-facing fields.
React loads that value once into a branding context and uses it for all
runtime-visible application labels. The native setup hook applies the same
window title to the Tauri window.

`Branding::home_dir_name` is a single directory name, not an absolute path.
The template resolves it under the current user's `~/` and exports the
resulting path as `RUXEX_HOME` before starting the App Server. This keeps the
normal process, in-process runtime, and hidden daemon on the same data home.

The static Tauri configuration remains responsible for installer metadata such
as `productName`, `identifier`, and the `ruxex` deep-link scheme. Those values
are packaging and compatibility boundaries, not runtime UI branding, and are
intentionally kept out of the Rust runtime branding DTO.

The existing `ruxex` names used by protocol fields, runtime package layout,
local-storage keys, and generated types remain unchanged. Only hard-coded
user-facing application labels are routed through `Branding`.

## Verification

- TypeScript tests cover the bridge, provider, and UI consumers.
- Rust tests cover the canonical branding values and `ProductIdentity`.
- The frontend test suite verifies that configured assistant labels flow into
  conversation and composer presentation.
- Run the template's frontend checks, Rust tests, and final diff checks.
