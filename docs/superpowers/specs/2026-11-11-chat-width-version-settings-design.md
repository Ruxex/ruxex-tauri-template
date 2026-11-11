# Chat Width and Version Settings Design

## Intent

Make the conversation body easier to scan by reducing its maximum width from
980px to 800px, and expose runtime version information in a dedicated Settings
tab.

## Goals

- Limit the chat workspace to `max-w-[800px]` while preserving full-width
  behavior on smaller screens.
- Add a `Version` settings route and sidebar entry.
- Show the desktop app version, connected App Server version, managed Ruxex
  version, and CLI version when available.
- Show `Unavailable` for version values that cannot be read without making the
  settings page unusable.

## Non-goals

- Do not change the app's version source or release process.
- Do not add version update actions.
- Do not expose filesystem paths or daemon controls on the Version page.

## Approaches

1. Use an 800px maximum width for the conversation body (chosen). This gives
   the requested roughly-80% reduction from the current 980px cap and keeps
   the layout stable on large displays.
2. Use an 80vw maximum width. This scales with the viewport, but makes the
   conversation wide again on large screens and does not provide a predictable
   reading width.

The chosen approach keeps the existing responsive `w-full` behavior and only
changes the large-screen cap. The Version page follows the existing settings
page pattern and reads the frontend version from `package.json`; App Server and
daemon values come from the existing query hooks.

## Constraints

- Follow the existing React Router, Tailwind, and settings sidebar patterns.
- Keep the Version page read-only.
- Cover route/sidebar presence and version fallback behavior with tests.
