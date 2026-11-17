# Vendored default artifact Skills

## Intent

Make the bundled `documents`, `presentations`, `spreadsheets`, and `pdf` Skills available in every Ruxex project and conversation without asking users to install or configure them. Keep these app-managed Skills separate from user-managed Skills.

## Decisions

- Keep user Skills in the existing `~/.ruxex_desktop/skills/` root.
- Add an app-managed `~/.ruxex_desktop/vendored/skills/` root for bundled Skills. Package the four definitions from `plugins/ruxex-artifacts/skills` and synchronize those app-owned directories into the vendored root during app initialization. In development builds, use the source tree if runtime package staging has not yet produced bundled Skills. Updating bundled Skills must not write to the user Skills root or unrelated vendored contents.
- Register the vendored root as a default App Server extra root on every connection so `skills/list` exposes these Skills globally across projects and threads. Retain user-added extra roots in app session state and register them with the vendored root after reconnect.
- `skills/extraRoots/set` replaces the complete session list and has no getter. Preserve the vendored root whenever user-added roots are submitted; do not show the vendored root as a removable user-added directory in the Skills settings UI.
- Keep the shared `ruxex-artifacts` executable and runtime package as-is; Skills call the same runtime.

## Approaches

- Copy Skills into the user Skills root: simplest discovery, but mixes app-owned files into the user's namespace and complicates updates. Rejected because user/app Skills should remain separate.
- Register a packaged resource directory directly: avoids syncing app data, but does not provide the requested `vendored/` location under the Ruxex home and makes path resolution depend on packaging layout.
- Sync app-owned Skills into `vendored/skills` and register that directory as the default extra root: selected because it keeps a stable, inspectable app-managed location while using the existing App Server discovery API.

## Constraints and acceptance

- No user action or per-project setup is required.
- Existing user Skills and user-added extra roots remain available and are not overwritten when default Skills are registered.
- Reconnecting to an existing App Server preserves the user's extra roots for the current desktop session.
- The four artifact Skills appear in Capabilities and the Composer after startup/reconnect; the vendored root cannot be removed through the user-added directory controls.
- Package tests cover staging the Skill definitions; Rust and frontend tests cover synchronization/registration and preserving the default root when changing extra roots.
