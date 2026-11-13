# UI Fixtures: Page Density Coverage

## Intent

Rework `make ui-fixtures` so screenshots show how real pages look with their own content and controls. Include ordinary and large data sets to reveal layout pressure, scrolling, and where pagination may be needed.

## Goals

- Capture each user-facing page in the real Tauri app, including its important populated states and major interactive states.
- For data-bearing pages, capture an ordinary amount and a large amount of representative data; retain empty states where they communicate useful behavior.
- Use stable, descriptive screenshot names that identify page and data density/state.
- Keep `make ui-fixtures` as the single complete capture entry point.

## Non-goals

- Component catalog or isolated component screenshots.
- Adding pagination or changing product behavior as part of fixture work.
- Committing generated screenshots or fixture homes.

## Approaches

- **Real-app page fixtures (chosen):** prepare representative data through the existing UI-driven WDIO workflow, then navigate and capture actual pages. This verifies page composition and data density together.
- **Component catalog capture:** capture isolated component stories. This does not answer how components look in their page context, so it is excluded.

## Constraints and implementation calls

- Preserve the fixture rule that app state is created and changed through GUI/accessibility interactions, not direct App Server, Tauri, or DOM state injection.
- Keep ordinary data large enough to show a representative populated page, and large data enough to exceed the visible area and exercise any existing paging or scrolling. Exact counts should be selected per page from the visible layout and supported app behavior.
- Cover route pages and reachable page-level dialogs, menus, and expanded states where they materially change the screenshot; avoid duplicating equivalent states across pages.
- Organize capture suites and fixture data so durable populated data can be reused for screenshot runs without making the run depend on a prior invocation.

## Approval

This design needs user approval before implementation.
