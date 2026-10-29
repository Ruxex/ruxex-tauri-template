# User Message Editing

## Intent

Let a user correct a completed text prompt after seeing the assistant reply.
The correction replaces the selected prompt and every later turn, then lets the
user submit the corrected text as a new turn.

## Approach

Add an Edit action to text user-message items. The workspace calls
`thread/revert` with the selected item's `turnId`, invalidates and reloads the
conversation, and restores the original text into the Composer. The existing
resume-before-action behavior is the prerequisite for the revert call.

## Scope and constraints

- Edit only completed text user messages with non-empty text.
- Do not expose edit for assistant/activity items or image-only inputs.
- Preserve the existing App Server history semantics: the selected turn and
  all later turns are removed from the active conversation path.
- The App Server remains the source of truth; no client-side history rewrite.
