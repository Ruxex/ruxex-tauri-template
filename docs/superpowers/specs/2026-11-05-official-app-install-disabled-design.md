# OpenAI App Install Disabled Design

## Intent

Ruxex does not support OpenAI Apps that depend on the OpenAI backend connector
runtime. When the marketplace response includes those entries, the Plugins page
must make the unsupported state clear and prevent an install attempt.

## Scope

- Detect Apps per plugin from the `apps` manifest declaration, usually
  `apps: "./.app.json"`; do not infer it from `openai-curated`.
- Keep plugin entries and their current status visible.
- Render a disabled, greyed-out install button for uninstalled Apps, with a
  hover title explaining that OpenAI Apps are not supported in Ruxex.
- Do not show the `Available` status badge for uninstalled entries.
- Keep each card stable as image, title/description, and action area. Long
  descriptions wrap only in the text column.
- Keep local ordinary plugins and remote-only marketplace behavior unchanged.
- Put marketplace reload and settings controls at the top of expanded Details.

## Approach

The backend parses the plugin's `apps` path and exposes the result through the
existing `PluginSummary.installPolicySource` field as
`IMPLICIT_CANONICAL_APP`. The UI uses this per-plugin value, not the
marketplace name. This reuses the existing protocol and keeps the policy ahead
of the local-path installability check.

The Details controls are a reload button next to a gear link to
`/settings/marketplaces`.

## Verification

Test that an `apps` declaration becomes `IMPLICIT_CANONICAL_APP`, that the UI
disables only that plugin, that ordinary plugins in the same marketplace remain
installable, that `Available` is absent, and that the card layout and Details
controls remain stable.
