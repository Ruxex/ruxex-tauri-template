# Quick Panel Settings and Plugin Layout Design

## Intent

Make the global quick panel discoverable and reliable from Settings, improve
the plugin marketplace's use of wide screens, and make missing plugin images
look intentional instead of appearing to load forever.

## Goals

- Add a General setting for the quick-panel global shortcut.
- Persist the shortcut in the desktop app's Rust-owned settings and register it
  with Tauri on startup.
- Allow changing the shortcut without restarting the app, with validation and a
  clear error when registration fails.
- Show plugin cards in two columns when the viewport is wide enough.
- Use DaisyUI `collapse` classes for marketplace and category disclosure.
- Render a recognizable image placeholder when App Server image fields are null
  or when asset loading fails.

## Non-goals

- No App Server protocol changes.
- No cloud synchronization of the shortcut.
- No OS-specific shortcut editor beyond Tauri's supported shortcut syntax.
- No change to plugin installation, marketplace loading, or image security
  policy.

## Constraints

- Rust owns the persisted shortcut value and native registration lifecycle.
- React reads and updates the value through Tauri commands; it does not invent a
  second persisted shortcut source.
- Existing user changes in the worktree must remain untouched.
- Existing quick-panel behavior and the default shortcut must remain backward
  compatible.

## Approaches

### Frontend-owned preference

Store the shortcut alongside UI preferences and tell Rust about it after the
frontend loads. This is smaller initially, but the native shortcut is not
available during startup and two layers can disagree after a crash or malformed
preference.

### Rust-owned preference (selected)

Store the shortcut under the Tauri app data directory, expose `read` and
`update` commands, and register exactly the stored shortcut during setup. The
React Settings page edits this native setting and refreshes its displayed value
from the command. This gives the global shortcut one authoritative lifecycle
and allows immediate re-registration.

## Design

### Shortcut lifecycle

- Rust defines the default `CmdOrCtrl+Shift+Space` and a small persisted native
  preferences document.
- On startup, Rust reads the preference, unregisters any stale registration if
  needed, and registers the stored shortcut.
- `quick_panel_shortcut_read` returns the current shortcut and default.
- `quick_panel_shortcut_update` validates a non-empty Tauri shortcut string,
  unregisters the current shortcut, registers the new one, and persists it only
  after registration succeeds. If registration fails, the old shortcut stays
  active and the old value remains persisted.
- The global-shortcut handler compares against the active stored shortcut and
  opens/focuses the existing `quick-panel` window.

### Settings UI

The General page gets a `Quick panel` SettingsPanel containing a text input for
Tauri shortcut syntax, the current shortcut, and Save/Reset actions. The input
is initialized from Rust, disabled while loading/saving, and displays command
errors inline. Reset writes the default through the same Rust command.

### Plugin marketplace layout

- Marketplace disclosure and category disclosure use DaisyUI's `collapse`
  component classes with a checkbox-based toggle, preserving independent open
  state for each section.
- Each category's plugin list uses `grid gap-2 lg:grid-cols-2`, so narrow
  layouts remain one column and wide layouts use two columns.

### Plugin image placeholder

`MarketplaceAssetImage` returns a small image-outline icon with an accessible
label when no local/remote source is supplied or when all validated asset loads
fail. It keeps the spinner only while at least one source is actively loading.

## Verification

- Rust unit tests cover default/read/update behavior and failed registration
  rollback.
- Settings tests cover loading, save, reset, and surfaced errors.
- Capability tests cover the wide-grid class, DaisyUI collapse classes, and
  null-image placeholder.
- Existing TypeScript, Biome, ESLint, Vitest, Rust, build, and diff checks run
  afterward.
