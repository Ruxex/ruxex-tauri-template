# Global Scrollbar Styling Design

## Intent

Apply one consistent, slim scrollbar appearance across the desktop app without
adding a dependency or requiring every scroll container to be updated.

## Goals

- Use a thin scrollbar with a transparent track.
- Use a subtle, rounded thumb with a slightly stronger hover state.
- Support Firefox-style scrollbar properties and Chromium/WebKit pseudo-elements.
- Keep the change isolated to the global stylesheet and preserve existing work.

## Non-goals

- Hiding scrollbars.
- Adding a scrollbar plugin.
- Changing component-specific overflow behavior or layout.

## Approaches

- Per-container Tailwind utilities: explicit but requires touching every current
  and future scroll container.
- Global CSS selectors: automatically covers the app and allows local overrides;
  this is the selected approach because the requirement is app-wide styling.

## Design

Add a global scrollbar block to `src/styles/index.css`. Set
`scrollbar-width: thin` and `scrollbar-color` for standards-based browsers;
define 6px WebKit scrollbars with a transparent track, rounded thumb, and hover
opacity change for Chromium/WebKit. Do not modify dependencies or components.
