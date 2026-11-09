# Design: Design review improvements

## Context

The full UI screenshot review found several places where the layout spends space
on low-value chrome or leaves useful content unnecessarily narrow. The goal is to
make the existing surfaces easier to scan without changing their information
architecture or behavior.

## Decisions

1. Keep the existing page and navigation structure, but allow the Skills page to
   use a wider content frame. Skill descriptions and paths should have room to
   breathe instead of being constrained to the same narrow two-column card.
2. Reduce theme preset card and preview density while retaining the existing
   visual previews and attribution note. Theme selection remains a grid.
3. Make MCP server fields use responsive two-column groups where fields are
   independent, reducing dialog height without hiding configuration options.
4. Make user-input answers full width and give the Login form a clearer, wider
   content frame.
5. On standalone approval and login routes, keep the global navigation rail but
   hide the unrelated chat context panel. This removes repeated empty states
   without removing navigation access.

## Non-goals

- No changes to protocol payloads, persistence, theme semantics, or route names.
- No destructive removal of form fields or advanced MCP configuration.
- No visual redesign of the populated conversation timeline beyond the input
  request card.

## Verification

- Add focused component/layout tests for each changed surface.
- Run the affected Vitest suites, then the full test/typecheck/build checks.
- Capture the same representative Tauri screens and inspect the resulting
  screenshots for the reviewed layouts.

## Follow-up visual decision

Theme cards use the recognizable third-party theme names because the attribution
note already explains the relationship. Mode labels such as “dark palette” are
omitted to reduce repetition, and the preview action label uses “Aa” as a
neutral typography cue instead of an implied action such as “Go”.
