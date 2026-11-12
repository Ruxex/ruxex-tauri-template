# Responsive Chat Columns Design

## Intent

Make the chat route easier to scan on wide desktop windows while protecting the
main conversation area on smaller windows. The chat workspace uses three
logical columns: a conversation minimap, the main chat, and the Thread Summary.

## Goals

- Keep the main chat column as the highest-priority content.
- Show the minimap only when the viewport has enough room and the conversation
  has at least five user messages.
- Show the Thread Summary from the initial chat render when the viewport has
  additional room beyond the minimap layout.
- Center the minimap vertically and keep its markers grouped around the center
  with a bounded interval rather than stretching them across the full track.
- Reduce the main column to approximately 70% of the existing chat width when
  both supporting columns are present.
- Keep the current AppServer data flow and make the summary column permanent
  whenever the responsive layout has room for it.

## Non-goals

- No AppServer, protocol, or persistence changes.
- No redesign of the minimap markers or Thread Summary contents.
- Supporting columns remain hidden below their responsive breakpoints.

## Approach

The workspace becomes a CSS grid with responsive variants. The minimap moves
from a fixed portal into the grid so it participates in layout without being
part of the main conversation's scroll flow.
The existing auto-scroll ref is shared with the minimap through the timeline
component. At 1360px the grid adds a narrow minimap column; at 1680px the
Thread Summary adds a narrow right column. When both are present the main column
uses `7fr`, leaving the main content at roughly 70% of the current workspace.

The Thread Summary is always rendered; it has no visibility toggle, close
button, or standalone title. The workspace uses the containing AppLayout's
1440px limit rather than adding
another 1200px limit. At the widest layout the grid uses a central main column
capped at 53rem and equal flexible side columns. The minimap is aligned to the
left edge of its column and the summary is aligned to the right edge of its
column. The workspace grid row uses the available chat viewport height, while
the main chat column owns the conversation scroll. The minimap column has a
fixed grid height and its own overflow boundary; the summary uses only the
height its content needs and scrolls internally when it exceeds the grid row.

## Acceptance criteria

- The narrow layout has one main column and no supporting columns.
- The medium layout adds the minimap column without reducing the main column to
  a fixed width.
- The wide layout always includes the Thread Summary column.
- Scrolling the main conversation leaves both supporting columns in place; only
  their own overflow areas can scroll.
- Existing minimap navigation and summary subagent interactions continue to
  work.
- Existing unit tests, typecheck, lint, and UI fixture capture pass.
