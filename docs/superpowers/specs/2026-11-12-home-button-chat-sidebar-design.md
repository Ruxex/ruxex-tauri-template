# Home button behavior on chat pages

## Intent

When the user is already viewing a chat, pressing the Home button should keep
the current conversation visible and open the Home chat sidebar. It should not
replace the chat with the new-chat screen.

## Goals and non-goals

- On `/chat/:threadId`, Home opens the Home/chat sidebar without navigating.
- On other routes, Home keeps its current navigation behavior to `/`.
- Preserve the existing sidebar toggle behavior when Home is already the active
  panel and the sidebar is open.
- Do not change the NewChat route, chat history loading, or persisted UI
  preferences.

## Approaches

1. **Guard navigation in `ProjectSidebar` (chosen).** Detect the current chat
   route where the Home rail action is handled, call the existing panel-change
   callback, and skip navigation only for that case. This keeps the route and
   sidebar interaction together and limits the change to the affected control.
2. **Centralize the decision in `AppLayout`.** Pass a route-aware navigation
   callback down into the sidebar. This would make layout own more behavior,
   but adds plumbing for a decision that only affects one sidebar action.

## Implementation and verification

- Add a regression test showing that Home on a chat route does not navigate and
  requests the Home panel to be open.
- Keep tests for normal Home navigation behavior passing.
- Run the focused test, the frontend test suite via `make check-tests`, and
  `git diff --check` before reporting completion.

