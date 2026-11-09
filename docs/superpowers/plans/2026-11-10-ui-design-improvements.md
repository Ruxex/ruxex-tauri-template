# UI design improvements implementation plan

## Scope

Implement the approved screenshot-review improvements in the existing checkout.

## Tasks

1. Add failing tests for the route-specific context-panel visibility, wider
   Skills layout, compact theme cards, responsive MCP field groups, full-width
   user-input answers, and Login form sizing.
2. Implement the layout changes with existing Tailwind/DaisyUI primitives.
3. Fix the project-chat fixture selector so the approved screenshot workflow can
   open the project-scoped New chat link reliably when the sidebar has a second
   New chat link.
4. Run focused tests, then typecheck/build and the full test suite.
5. Re-run representative Tauri screenshots and inspect the updated surfaces.

## Acceptance criteria

- Skills content can use the page width and long descriptions are not forced into
  a narrow half-column.
- Theme cards are visibly more compact while remaining selectable and labeled.
- MCP add/edit dialogs show independent fields in responsive columns and remain
  usable on narrow screens.
- User-input answers span the available card width.
- Login and standalone approval routes do not show an unrelated empty chat panel.
- Existing behavior and accessible labels remain intact.
