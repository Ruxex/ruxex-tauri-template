# Responsive Chat Columns Design

## Intent

Make the chat route easier to scan on wide desktop windows while protecting the
main conversation area on smaller windows. The chat workspace uses three
logical columns: a conversation minimap, the main chat, and the Thread Summary.

## Goals

- Keep the main chat column as the highest-priority content.
- Show the minimap only when the viewport has enough room and the conversation
  has at least five user messages.
- Show the Thread Summary only when it is open and the viewport has additional
  room beyond the minimap layout.
- Reduce the main column to approximately 70% of the existing 1200px chat
  workspace when both supporting columns are present.
- Keep the current AppServer data flow and the existing summary open/close
  interaction unchanged.

## Non-goals

- No AppServer, protocol, or persistence changes.
- No redesign of the minimap markers or Thread Summary contents.
- No mobile overlay replacement for the existing summary button.

## Approach

The workspace becomes a CSS grid with responsive variants. The minimap moves
from a fixed portal into the grid so it participates in layout and scrolling.
The existing auto-scroll ref is shared with the minimap through the timeline
component. At 1360px the grid adds a narrow minimap column; at 1680px an open
Thread Summary adds a narrow right column. When both are present the main column
uses `7fr`, leaving the main content at roughly 70% of the current workspace.

The Thread Summary remains user-opened rather than being forced open on every
wide screen. Its column is therefore only allocated after the user opens it.

## Acceptance criteria

- The narrow layout has one main column and no supporting columns.
- The medium layout adds the minimap column without reducing the main column to
  a fixed width.
- The wide layout adds the Thread Summary column only while it is open.
- Existing minimap navigation and summary subagent interactions continue to
  work.
- Existing unit tests, typecheck, lint, and UI fixture capture pass.
