# Chat loading and bubble spacing design

## Intent

Improve the chat transition UI by centering the new-thread loading indicator in
the available chat area and slightly reducing vertical padding inside chat
bubbles.

## Scope

- Wrap the conversation loading state in a full-height flex container with
  centered alignment.
- Reduce the vertical padding of user message bubbles from `py-2` to `py-1.5`.
- Reduce the vertical padding of assistant message bubbles from `py-3` to
  `py-2`.
- Preserve the existing horizontal spacing, colors, message actions, and
  loading semantics.

## Approaches

- Recommended: make the existing `ConversationWorkspace` loading branch a
  centered flex layout and adjust the existing `ConversationItem` utility
  classes. This is the smallest change and keeps the behavior local to the
  affected components.
- Alternative: introduce shared loading and bubble-spacing CSS abstractions.
  This would centralize styling but expands the change without a current
  cross-screen requirement.

## Verification

- Add a regression test that asserts the loading state uses centered layout
  classes.
- Update the conversation item test to assert the reduced user bubble padding.
- Run the focused Vitest tests, then the repository frontend checks through the
  supported Makefile entrypoint.
