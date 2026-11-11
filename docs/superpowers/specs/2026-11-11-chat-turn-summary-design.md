# Chat Turn Summary Design

## Intent

Make the conversation timeline easier to scan by keeping a completed turn's
final assistant response visible while moving intermediate reasoning, tool
calls, and partial assistant messages into an expandable duration summary.

## Scope

- Align the active `Working for …` indicator to the left.
- Place the active indicator immediately after the active turn's user message.
- When a turn completes, render its user message and final assistant message
  normally.
- Put the completed turn's other visible items into a collapsed `<details>`
  block summarized by `Worked for …`.
- Apply the same completed-turn summary behavior to loaded history.
- Keep failed or interrupted turns expanded so diagnostic activity is not
  hidden.
- Preserve existing item renderers, editing, approval controls, and timeline
  auto-scroll behavior.

## Approach

Pass the authoritative turn list from `ConversationWorkspace` to
`ChatActivityTimeline`. The timeline will group visible items by `turnId`, use
completed turn statuses to decide when to summarize, and render existing
`ConversationItem` / `ActivityItem` components inside or outside the details
block as appropriate. Live status continues to control the active indicator;
the existing completed-turn payload supplies the live duration immediately
after completion.

## Non-goals

No protocol, event-reducer, persistence, item normalization, approval
behavior, or composer changes are included.
