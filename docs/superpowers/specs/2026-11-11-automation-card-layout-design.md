# Automation Card Layout Design

## Intent

Reduce repeated labels and visual noise in individual automation cards while
keeping the controls understandable and accessible.

## Scope

- Remove the visible `Automation` eyebrow from each card.
- Remove the visible `Enabled`/`Disabled` text; retain the toggle's accessible
  label and state.
- Remove the calendar icon from the schedule details button.
- Remove the `Schedule` eyebrow from the schedule details button.
- Keep the card title and the schedule details as two lines, with `Next run`
  directly beneath the title.
- Make `Run now` and delete icon-only controls, positioned to the left of the
  Enabled toggle.

## Approach

Update the existing `ScheduleCard` markup and styling only. Preserve semantic
button labels and titles for screen readers and tooltips, and update the
existing page test to assert the visible labels are gone while actions remain
available by accessible name.

## Non-goals

No schedule behavior, API, data model, modal copy, or page-level navigation
changes are included.
