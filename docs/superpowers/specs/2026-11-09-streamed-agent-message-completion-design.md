# Streamed Agent Message Completion Design

## Intent

Prevent the desktop conversation timeline from rendering an assistant message
twice when a provider uses one item ID for streamed deltas and another item ID
for the completed item containing the accumulated text.

## Goals

- Treat delta-created assistant messages as temporary live output.
- Replace the latest same-turn delta-only assistant message with the completed
  `agentMessage`, even when their IDs differ.
- Preserve the existing same-ID update behavior.
- Keep other item types and messages from other turns unchanged.

## Non-goals

- Changing App Server protocol types or provider behavior.
- Changing the presentation-layer merge rules.
- Reconciliating unrelated completed items or multiple independent assistant
  messages beyond the latest delta-only item in the same turn.

## Approach

Update the Tauri event reducer's `item/completed` path. For a completed
`agentMessage`, first update an item with the same `(turnId, itemId)` as today;
when no such item exists, replace the latest same-turn `agentMessage` without a
`raw` completed item. The replacement receives the completed item's ID and raw
payload, so the live state has one authoritative assistant message.

## Acceptance criteria

- A delta item followed by a completed agent message with a different ID leaves
  one item containing the completed message text.
- A delta item followed by a same-ID completion remains one item and preserves
  the completed raw item.
- A completion without a matching delta item is still inserted normally.
- Existing reducer tests continue to pass.
