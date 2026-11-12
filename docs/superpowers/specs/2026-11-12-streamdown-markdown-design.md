# Streamdown Markdown Rendering

## Intent

Use Vercel's Streamdown renderer for assistant and activity Markdown so partial Markdown produced during streaming is presented smoothly without frontend text-diff tracking.

## Scope

- Replace the repository-owned Markdown parser used by chat content with `streamdown`.
- Keep `MessageContent`'s Visualize reference splitting and render those references through the existing `VisualizeFrame`.
- Preserve selectable chat content and existing command/activity callers.
- Do not add client-side delta arrays or text-diff state.

## Approach

Use Streamdown's streaming mode and `isAnimating` prop at the Markdown boundary. The wrapper will continue to own Visualize segmentation, while Streamdown owns Markdown parsing, incomplete-markdown handling, and reveal animation. Static callers will render with animation disabled.

## Constraints

- Use the current React 19 and Tailwind setup.
- Keep link, code, list, table, and diff rendering behavior covered by tests.
- Respect reduced-motion preferences through the renderer's CSS and project styles.
