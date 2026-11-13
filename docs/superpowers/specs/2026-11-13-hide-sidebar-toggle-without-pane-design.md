# Hide the global sidebar toggle when no pane is available

## Intent

Hide the global header's left-pane toggle on routes where the context pane is not available, so users are not offered a control that can open a pane on those screens.

## Scope

- Reuse `AppLayout`'s existing `hidesContextPanel` route condition for Projects, Account, and Approvals.
- Pass `onToggleSidebar` to `BrowserNavigationBar` only when the context pane is available; the bar already omits its button when this callback is absent.
- Keep all other left-pane behavior and right-pane controls unchanged.

## Approaches

- Conditionally pass the callback from `AppLayout` (chosen): uses the existing route visibility rule and the header's current optional callback API.
- Add route awareness to `BrowserNavigationBar`: duplicates app route policy in a presentation component.
- Keep the button disabled: still presents a control users cannot use and does not meet the request to hide it.

## Constraints and non-goals

No route, sidebar, or preference behavior changes. No new route policy or persistent state. The existing pane visibility condition remains the source of truth.
