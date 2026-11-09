# Chat Composer and Effort Display Design

## Intent

Make chat composition behave like a Slack/Codex-style message editor: Enter inserts a newline, Ctrl+Enter submits, and Markdown is rendered in the editable surface itself. Remove misleading effort text when the selected model does not advertise any reasoning efforts.

## Goals

- Apply the same Ctrl+Enter submission shortcut to both existing-thread and new-thread composers.
- Preserve normal Enter and Shift+Enter as newline-producing input.
- Use a Milkdown/Crepe WYSIWYG Markdown editor so headings, lists, emphasis, links, and code are rendered while typing without a separate preview pane.
- Keep slash-command selection and editor focus behavior intact when editing.
- Show no effort label when effort is unavailable; keep displaying the selected effort when one is available.

## Non-goals

- Add a new Markdown parser outside the selected Milkdown/Crepe editor dependency.
- Add a preview toggle or a second rendered copy of the message.
- Change the message payload format or server-side submission semantics.
- Change effort selection options beyond hiding the unavailable display state.

## Constraints

- Both `Composer` and `NewChatComposer` must share the same keyboard semantics.
- IME composition must never submit on Ctrl+Enter while composition is active.
- The Milkdown editor must preserve Markdown serialization for the existing message payload.
- Empty or unavailable effort data must not fall back to the visible string `medium`.

## Approaches

1. **Milkdown/Crepe WYSIWYG editor (chosen):** provides a single editable surface with Markdown serialization, list shortcuts, and rich formatting without maintaining a custom cursor mapping layer.
2. **Textarea with always-on rendering beside it:** preserves native textarea behavior but does not satisfy the requested in-surface rendering.
3. **Textarea only, render after send:** smallest change, but does not satisfy the request to inspect Markdown formatting while composing.

## Implementation decisions

- Add a shared `ComposerMessageInput` that owns the Milkdown/Crepe instance, emits serialized Markdown through `onChange`, exposes the contenteditable element for focus, and forwards keyboard events to the parent form.
- Disable editor features that are not needed in a compact chat composer, while retaining common Markdown editing and list support.
- Add a shared keyboard predicate/helper so both composers submit only for Ctrl+Enter and ignore composing events.
- Make `defaultEffortForModel` return an empty string when the selected model has no supported efforts, and make the settings summary render effort text only when an effort is available.
- Cover shortcut behavior, preview rendering, and unavailable-effort display with component tests.
