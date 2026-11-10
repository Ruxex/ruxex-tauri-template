# Desktop Skill Policy Design

## Intent

Let a TauriTemplate consumer define provider-specific Skill restrictions once
in the Rust `DesktopConfig`, then apply that policy consistently to both the
embedded App Server and the React UI.

## Goals

- Keep product-owned Skill restrictions in the Rust composition root.
- Disable restricted Skills in both daemon and in-process App Server modes.
- Hide restricted Skills in the UI based on the Tauri-owned policy, not on the
  App Server `skills/list` response.
- Preserve user-managed enablement for Skills that the product does not
  restrict.
- Keep browser/Vitest execution independent from native Tauri IPC.

## Non-goals

- Do not change the upstream App Server protocol or add provider capability
  fields.
- Do not remove restricted Skills from the App Server catalog response; the UI
  owns the presentation filter.
- Do not overwrite unrelated user Skill configuration rules.

## Approach

`DesktopConfig` gains a `SkillPolicy` containing product-disabled Skill names.
The same policy is exposed as a serializable `DesktopUiPolicy` through a new
`get_desktop_ui_policy` Tauri command. After the App Server connection is
established, the host applies one `skills/config/write` request per restricted
name, while React filters the Skills list using the command result before
rendering it.

The policy defaults to empty so existing Ruxex behavior is preserved. A
provider-specific composition root can call `disable_skill("imagegen")` to
make the Skill unavailable to the runtime and invisible in the UI.

## Design

`SkillPolicy` owns a deterministic, deduplicated set of disabled Skill names.
It provides:

- a serializable UI projection with `hiddenSkills`;
- Ruxex CLI/session override values for `skills.config`;
- a builder method for provider hosts to add restrictions.

`src-tauri/src/lib.rs` registers the new command. `src/platform/skill-policy.ts`
provides the cached native policy and a shared filter. The `CapabilitiesPage`
filters product-hidden group members and removes empty groups before
rendering, while still using the App Server's `enabled` value for the toggle
state of visible Skills. The Composer applies both filters: product-hidden
names and App Server-disabled (`enabled: false`) Skills are excluded from
slash selection.

The request is applied through the common `AppServerClient` wrapper, so daemon
and in-process modes share the same behavior. Applying individual config edits
preserves unrelated user Skill rules; passing a whole `skills.config` array as
a CLI override would replace those rules and is intentionally avoided. The
policy is therefore DI-owned and is not inferred from server responses.

## Verification

- Rust tests cover policy deduplication, UI serialization, and generated
  `skills.config` overrides.
- TypeScript tests cover the native bridge and filtering of restricted Skills.
- Run the focused frontend tests, `make check-tests`, `make rust-test`, and
  final diff checks.
