# Inline Message Actions Design

## Intent

Make user messages compact while exposing useful actions without adding permanent visual noise, and let corrections happen directly where the message appears.

## Design

User message bubbles use reduced horizontal and vertical padding. Each user message reserves a fixed-height action area immediately below the bubble; its timestamp, icon-only copy button, and icon-only edit button become visible on hover or keyboard focus. The timestamp uses the containing turn's `startedAt` value because thread item payloads do not carry their own timestamp.

Selecting Edit replaces that message bubble with a wide textarea containing the current text and Cancel/Send buttons. Cancel restores the normal bubble without a server call. Send preserves the existing correction semantics: revert the thread before the selected turn, then start a new turn with the edited text.

## Non-goals

- No protocol or App Server changes.
- No change to assistant/activity item presentation.
- No reuse of the bottom Composer for inline edits.
