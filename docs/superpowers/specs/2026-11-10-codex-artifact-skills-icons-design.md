# Codex-style artifact Skills and icons

## Intent

Expose Ruxex's artifact workflows using the same user-facing Skill names as
Codex and show each Skill's optional interface icon wherever Skills are shown.

## Scope

- Split the bundled `ruxex-artifacts` plugin's single Skill into four Skills:
  `documents`, `presentations`, `spreadsheets`, and `pdf`.
- Keep the plugin and bundled `ruxex-artifacts` runtime shared; this is a Skill
  boundary change, not four independent runtimes.
- Add Codex-compatible `agents/openai.yaml` metadata to each Skill. Icon
  metadata remains optional; the bundled artifact Skills intentionally omit
  icon assets for now.
- Render `interface.iconSmall` (falling back to `iconLarge`) in the Tauri
  Capabilities Skill list, Composer slash palette, selected Skill chip, and
  plugin Skill detail list.
- Preserve a generic Sparkles icon when a Skill has no icon metadata.

## Non-goals

- Do not change the artifact command or JavaScript API names.
- Do not add per-format provider policy in this change; the four Skill names
  become independently addressable by the existing DI policy.
- Do not expose arbitrary filesystem paths to the browser. Icon bytes must be
  read through a native, root-constrained, image-validated Tauri command.

## Metadata and assets

Each Skill has a `SKILL.md` and `agents/openai.yaml`. The metadata may use
`interface.display_name`, `short_description`, `icon_small`, `icon_large`, and
`brand_color`; the four bundled artifact Skills currently use only the display
metadata and rely on the generic fallback icon. Ruxex's legacy
`agents/ruxex.yaml` remains supported by the upstream loader, but new bundled
Skills use `openai.yaml`.

## UI behavior

The frontend consumes the existing App Server `SkillMetadata.interface` fields.
The icon loader accepts absolute local paths returned by the App Server and
optional approved HTTPS URLs, caches the result, and falls back to a generic
Skill icon if loading fails or metadata is absent. Product-hidden Skills remain
filtered before rendering.

## Acceptance criteria

- `skills/list` exposes four artifact Skill names, with no `ruxex-artifacts`
  Skill entry.
- Each artifact Skill returns display metadata and no icon path for now.
- Capabilities, Composer candidates, selected Skill chip, and plugin details
  show the supplied icon when present; these iconless bundled Skills render
  the generic fallback correctly.
- Existing artifact CLI/runtime tests and the full frontend/Rust test suites
  remain green.
