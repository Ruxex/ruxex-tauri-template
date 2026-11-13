# Fixed breadcrumb offset design

## Intent

Move the breadcrumb away from the far-left controls and place it after a vertical divider at a fixed offset roughly matching the standard left pane width. This gives the header a stable visual split without coupling it to the resizable sidebar.

## Goals

- Keep the browser navigation and pane toggle controls on the left.
- Add a vertical divider at a fixed desktop offset (initial proposal: 320px from the window's left edge).
- Render breadcrumbs to the right of that divider, using the remaining width and preserving truncation for long labels.
- Keep the right pane toggle at the far right.

## Non-goals and anti-goals

- Do not synchronize the divider with the left pane's live resized width.
- Do not move the breadcrumb into the main content pane or create a second header row.
- Do not change breadcrumb routes, labels, or navigation behavior.
- Avoid a divider that implies an exact live boundary when the sidebar has been resized or collapsed; the offset is intentionally fixed.

## Constraints

- The current `BrowserNavigationBar` is a full-width row above the resizable panel group in `AppLayout`.
- The left pane has a default width of about 320px, is resizable, and collapses to a 64px rail.
- Browser history, sidebar toggle, right pane toggle, and breadcrumbs currently share this bar.

## Approaches

1. **Place the breadcrumb in the main pane header.** The pane boundary would align naturally through resizing and collapse, but this adds a separate header area and changes the current shared navigation hierarchy.
2. **Synchronize a split header with the live sidebar width.** This keeps a single row and exact alignment, but requires coordination between the resizable panel and header, including collapse behavior.
3. **Reserve a fixed-width left track in the existing header.** Put the divider at the track's right edge and place breadcrumbs in the flexible track after it. This avoids sidebar synchronization and keeps the current single-row header. The divider remains fixed when the pane is resized or collapsed.

## Proposed approach

Use approach 3. Reserve a 320px left track in the existing header, put a vertical border on its right edge, and render the breadcrumb in the flexible right track. Preserve the existing controls in the left track and the right pane toggle at the far right. Keep breadcrumb truncation when space is limited. The 320px offset is a fixed visual reference based on the standard left pane width; it does not represent the current live sidebar width.

## Builder decisions

- Keep the 320px offset fixed as the sidebar is resized or collapsed; let the breadcrumb use the remaining space and truncate when needed.
- Keep the implementation within the existing React/Tailwind layout and current navigation component unless the code inspection reveals a concrete constraint.
