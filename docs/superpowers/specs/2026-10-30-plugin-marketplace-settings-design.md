# Plugin Marketplace Settings Design

## Intent

Make `/settings/marketplaces` visually consistent with the other settings
pages. The page should read as a settings surface rather than a stack of
generic cards, while preserving all existing marketplace operations.

## Scope

- Use the existing settings page width, heading, `SettingsPanel` header, and
  divided-row visual language.
- Present the add-marketplace form as a compact settings panel with aligned
  labels and controls.
- Present configured marketplaces as divided rows with marketplace identity,
  plugin count, and grouped Update/Remove actions.
- Keep loading, error, validation, confirmation, mutation, and empty-state
  behavior unchanged.
- Keep the page responsive: rows may stack on narrow screens and controls must
  remain full-width where appropriate.

## Chosen approach

Use two `SettingsPanel` sections, one for adding a marketplace and one for the
configured list. This matches General, Appearance, Models, and Runtime pages
without hiding the distinction between creating a new source and managing an
existing source.

## Non-goals

- No changes to marketplace API payloads or query behavior.
- No new marketplace actions or plugin management capabilities.
- No redesign of the separate Plugins/Skills/MCP capabilities page.

## Verification

Update `MarketplaceSettingsPage.test.tsx` to assert the settings-panel
structure and existing actions, then run the focused test, the frontend test
suite, TypeScript checks, formatting, and `git diff --check`.
