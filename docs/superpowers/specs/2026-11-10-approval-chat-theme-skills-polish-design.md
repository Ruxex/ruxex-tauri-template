# Approval, Chat, Theme, and Skills UI Polish

## Intent

Reduce duplicated information and improve scanability in approval requests,
chat lists, theme selection, and the Skills capability page. The changes are
visual and interaction-level improvements; protocol behavior and server
contracts remain unchanged.

## Goals

- Show one concise permission-access block in approval requests, without the
  generic request summary or duplicated `Write`/reason information.
- Render project chats and archived chats through the same chat-row component,
  with friendly update time aligned in the row's trailing area and contextual
  icon actions.
- Keep the selected theme preview visible outside the theme selector, next to
  the selector control.
- Use DaisyUI toggles for Skills, show the shortest available description, and
  group skills by their returned source directory in collapsible sections.
- Label Ruxex's built-in/system skill group as `Default` without exposing its
  filesystem path.
- Use the shared `EmptyState` component for an empty Marketplace list so it
  matches other list pages and does not show the removed secondary description.

## Non-goals

- No changes to App Server protocol types or request/response payloads.
- No migration or backward-compatibility work for stored preferences.
- No changes to approval decision semantics or skill enable/disable mutation
  behavior.
- No changes to the Marketplace settings flow.

## Constraints

- Preserve accessible names for all approval actions, chat actions, and skill
  toggles.
- Keep friendly relative timestamps and absolute timestamps in `title`
  attributes.
- Prefer `skill.interface?.shortDescription`, then legacy
  `skill.shortDescription`, then a bounded/truncated `skill.description`.
- Treat a source group as built-in when its skills have `scope === "system"`;
  render that group as `Default`. Other groups retain their source directory
  label.
- Keep generated screenshots and fixture homes ignored.

## Approaches

### Approval request details

1. Keep both summary and details, but deduplicate individual rows. This still
   leaves too much vertical repetition and does not address the user's concern.
2. Remove the generic request summary and replace the permission summary plus
   details accordion with one access panel containing the reason and each
   requested capability/path. This is the selected approach because it keeps
   the useful information while removing duplicate content.

### Shared chat rows

1. Adjust only the two page layouts independently. This would make future chat
   list changes drift again.
2. Extend `ChatListItem` with trailing metadata/actions and let `ThreadCard`
   delegate to it for both project and archive rows. This is the selected
   approach because it keeps one row layout while allowing different action
   sets.

### Skills source groups

1. Keep the existing nested lists and only add a visual heading. This does not
   provide the requested collapse behavior.
2. Make each returned `SkillsListEntry` a controlled-by-HTML `<details>` group,
   label system-scoped groups `Default`, and render concise skill rows with
   DaisyUI toggles. This is the selected approach because the response already
   supplies the source grouping and scope needed for the distinction.

## Design decisions

- Approval permissions use one `Requested access` region. Its list is the
  single source for network, read, write, and entry access labels; the generic
  `Request summary` region is removed.
- `ChatListItem` accepts a trailing action slot and renders `Updated …` in the
  trailing column when requested. The main link remains the row's navigation
  surface; action buttons stop propagation.
- `ThreadCard` remains the common adapter for full-width and compact rows, but
  passes actions into the shared chat row rather than rendering a separate
  bottom action area.
- The theme selector summary contains only the selector label/value and
  disclosure affordance. The selected preview is rendered in a sibling panel
  beside it, with responsive stacking when narrow.
- Skills descriptions are line-clamped to two lines, with the full source
  description available through the element's `title` when it is longer.
- Marketplace's empty branch uses `EmptyState` with its existing title and
  “Add plugin marketplace” action.

## Verification

- Add/update focused Vitest tests for approval deduplication, chat timestamp
  placement/action reuse, theme preview placement, skill groups/toggles/short
  descriptions, and Marketplace empty state.
- Run the focused tests, then the full Vitest suite, typecheck, Biome/ESLint,
  and production build.
- Run `make ui-fixtures` and refresh the ignored screenshot gallery to inspect
  the affected pages.
