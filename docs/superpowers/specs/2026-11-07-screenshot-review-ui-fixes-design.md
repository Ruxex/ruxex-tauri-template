# Screenshot Review UI Fixes Design

## Intent

Improve the UI states exposed by the existing screenshot fixtures without
changing the marketplace image fallback. The focus is on making empty,
installed, approval, queued, and streaming states understandable in a
1280x800 desktop viewport.

## Goals

- Give the empty Plugins page a clear explanation and route to add a
  marketplace.
- Make plugin detail sections use available width when optional sections are
  absent, while keeping the existing information order.
- Make installed plugin state visible beyond an icon and keep the fixture's
  installed card in view when its screenshot is captured.
- Reduce approval-card metadata noise behind a user-controlled details section.
- Show explicit visual labels for active work and queued messages.
- Keep screenshot scenarios deterministic by resetting the relevant sidebar
  state before capture.

## Non-goals

- Changing marketplace image loading or its fallback icon.
- Changing App Server protocols, persistence, or approval semantics.
- Adding screenshots for every route in this change.

## Approach

Use small presentation changes in the existing page and component boundaries,
backed by component tests for the new visible labels, empty-state CTA,
responsive detail layout, and collapsed approval metadata. Update the fixture
only where the screenshot framing itself is nondeterministic.

## Acceptance criteria

- Empty Plugins state has a visible primary action linking to Marketplace
  settings.
- A plugin detail page with only Skills does not render a one-third-width card
  with two-thirds empty space.
- Installed plugin cards expose an `Installed` status and the fixture captures
  the installed card without relying on an accidental scroll position.
- Approval cards show request meaning first and expose raw scope metadata via a
  disclosure.
- Active work and queued message states have visible text labels.
- Existing tests and the marketplace fixture remain passing.
