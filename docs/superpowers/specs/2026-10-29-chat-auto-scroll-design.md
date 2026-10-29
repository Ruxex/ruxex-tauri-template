# Chat Auto-Scroll Design

## Intent

Keep the chat view useful during active conversations: a newly sent user
message should bring the conversation to the latest position, while incoming
replies should only follow the viewport when the user was already reading the
bottom of the conversation.

## Scope and constraints

- Change only the native Tauri repository.
- The scroll container is `TaskActivityTimeline`.
- Initial rendering must not force an existing conversation to the bottom.
- A user who has scrolled up must keep their reading position when replies or
  streaming activity arrive.
- Being within a small tolerance of the bottom counts as being at the bottom.

## Approach

`TaskActivityTimeline` owns a scroll ref and tracks whether the user was at the
bottom before each content update. New user-message items always scroll to the
bottom. Other new or updated timeline content scrolls only when the tracked
pre-update state says the user was at the bottom. `useLayoutEffect` performs the
scroll after React has committed the new content and before the browser paints.

## Non-goals

- No change to message fetching, event reduction, or composer submission.
- No new visible scroll controls or unread-reply indicator.
