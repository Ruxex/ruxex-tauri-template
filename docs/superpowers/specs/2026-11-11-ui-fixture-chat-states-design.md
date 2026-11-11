# Chat UI Fixture States Design

## Intent

Add deterministic `ui-fixtures` coverage for the new chat timeline states so
the screenshot gallery shows the active working indicator, completed long
responses, completed-turn details, expanded details, and the conversation
minimap.

## Goals

- Capture `example:long-stream:slow` while the turn is still running.
- Capture `example:long-stream` after completion.
- Capture an existing multi-step `workflow` turn after completion with its
  `Worked for ...` details collapsed, then expanded.
- Capture a single conversation with at least seven user messages and the
  minimap visible on the left.
- Keep the Example provider unchanged; use its existing deterministic markers.

## Non-goals

- Do not change production chat rendering or minimap breakpoints.
- Do not add a new provider protocol scenario.
- Do not change the persistent fixture catalog counts.

## Approach

Extend the existing volatile fixture catalog and spec. The slow and long
screenshots use the existing `long-stream` provider scenario. The collapsed
and expanded completed-turn screenshots use `workflow`, which already emits
intermediate assistant/tool items in one turn. The minimap scenario sends
seven basic prompts in one thread and temporarily resizes the desktop window
wide enough for the existing `min-[1760px]` layout rule.

## Verification

Run the fixture catalog/support tests, the focused volatile E2E spec, then
`make ui-fixtures`. Inspect the new screenshots and refresh the local gallery
on port 8765.
