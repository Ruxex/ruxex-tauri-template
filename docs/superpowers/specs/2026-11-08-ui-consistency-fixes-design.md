# UI Consistency Fixes Design

## Intent

Make the desktop UI states used by the screenshot fixtures easier to read and
more consistent without changing backend semantics or marketplace image
fallback behavior.

## Goals

- Make the active Capabilities section and installed plugin count visible.
- Use `App Server` consistently for the settings route and breadcrumb.
- Separate MCP connection, authentication, and resource information.
- Share dialog headers, footers, and spacing across the main modal flows.
- Give empty states a common visual structure and avoid sparse one-card grids.
- Make screenshot capture wait for the Home page's initial loading state to
  settle.

## Non-goals

- Changing MCP protocols, authentication behavior, or persistence.
- Changing marketplace image loading or its fallback icon.
- Redesigning chat titles, approval actions, or the existing working/queued
  labels, which already provide explicit text.

## Approach

Add small presentation components in the existing common component folders,
then migrate the affected pages and dialogs. Tests pin the visible labels,
active navigation semantics, status wording, shared layout classes, and
single-card behavior. The fixture change only adds a semantic wait and does
not inject UI state.

## Acceptance criteria

- Capabilities navigation exposes the selected tab with `aria-current="page"`
  and an active menu style; Installed shows its count.
- The settings navigation and App Server page use `App Server` consistently.
- MCP rows label connection and authentication separately, including a
  neutral `Status unavailable` state when resources are still present.
- The main dialogs use common header/footer layout primitives.
- Empty states share icon/title/description/action spacing where applicable.
- A single saved automation uses a constrained single-column layout.
- Home screenshot capture does not capture `Loading projects...`.
