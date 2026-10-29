# Command Activity Live State Design

## Intent

Prevent command activity collapses from appearing one item behind and prevent
completed command activities from sharing the running state of a later command.

## Goals

- Keep live activity state limited to the current turn.
- Let saved thread history own completed turns.
- Match activity identity with both `turnId` and `itemId`.
- Show loading only for activities that are actually in progress.
- Add regression coverage for repeated command turns and delayed history.

## Non-goals

- Redesign the app-server event protocol.
- Change the original Ruxex repository.
- Build a full event-log replay layer for every historical turn.

## Approach

The reducer will clear the previous live-item window when a new turn starts and
retain the just-completed window only until the next turn begins. Conversation
merging will continue to combine saved history with live data, but live data
will be identified by `turnId` plus `itemId`. Timeline React keys will use the
same composite identity. Loading state will be derived from the active live
turn rather than from the presence of any historical live item.

When a turn completes without a final structured item update, the live view
will use the completed turn status to stop showing an in-progress spinner;
the authoritative history remains responsible for the final item metadata.

## Files

- `src/app-server/event-reducer.ts`: scope live items to the current turn and
  expose enough turn state for rendering.
- `src/components/conversation/conversation-model.ts`: merge using composite
  item identity and apply live turn status to fallback activity metadata.
- `src/components/conversation/ConversationWorkspace.tsx`: pass the live
  execution status into the conversation merge.
- `src/components/tasks/TaskActivityTimeline.tsx`: use composite React keys and
  active-turn loading semantics.
- Existing reducer, conversation, timeline, and activity tests: cover the
  lifecycle and rendering regressions.

