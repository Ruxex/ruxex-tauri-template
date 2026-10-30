# Working Duration Indicator

## Intent

Replace the bottom-of-chat running spinner with a compact Codex-style status
line such as `Working for 42s`, followed by a divider. This keeps the current
streaming messages visible as the main progress signal while still showing
that the turn is active and how long it has been running.

## Scope

- Pass the active turn's `startedAt` timestamp from `ConversationWorkspace` to
  `ChatActivityTimeline`.
- While the thread is `running` or `resynchronizing`, update and display the
  elapsed whole seconds once per second.
- Keep the existing message/activity rendering and pending approval order
  unchanged.
- Remove the separate centered spinner from the chat timeline.

The loading spinner used while initially loading conversation data and the
small activity-level progress indicators remain unchanged.

## Approaches

- Derive elapsed time from the active turn's protocol timestamp in the
  timeline (chosen): accurate across rerenders and keeps timing presentation
  local to the status line.
- Manage elapsed time in `ConversationWorkspace`: possible, but it spreads
  presentation state into the data orchestration component.
- Infer duration from live item timestamps: rejected because live items do not
  represent the turn start reliably.

## Design decisions

- Display text uses `Working for Ns`, including `0s` immediately after start.
- The indicator is rendered immediately before items belonging to the active
  turn, after any earlier conversation history and before pending requests.
  This produces the Codex-like `Working for Ns` → divider → current messages
  sequence while preserving approval placement at the bottom.
- If no valid start timestamp is available, show `Working` without inventing a
  duration.

## Verification

Add component tests covering the duration label, the absence of the spinner,
and preservation of pending-request ordering. Run the focused Vitest test,
the frontend suite, `make rust-test`, and `git diff --check`.
