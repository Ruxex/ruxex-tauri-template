# Project Create Page Design

## Intent

Move new-project creation from the Projects list modal to a dedicated `/projects/new` page. The form then participates in normal page scrolling, so icon and color selectors are not constrained by daisyUI's scrollable `modal-box`.

## Goals

- Keep `/projects` focused on browsing existing projects.
- Make the new-project form directly addressable and easier to use on short or narrow windows.
- Preserve the current fields, validation, folder picker, metadata selection, and create mutation.
- Return to the created project's page after a successful create.

## Non-goals

- Change project metadata options or the existing project-edit dialog.
- Add a new popover/portal abstraction.
- Change project API behavior.

## Approach

The create form will become `NewProjectPage`, linked from the Projects list at `/projects/new`. The form will keep the existing controls and use `useNavigate` after the mutation succeeds. The selector popups remain positioned within the regular page flow; the page itself may scroll when needed.

The alternative of keeping the modal and rendering selectors through a body portal was rejected because it preserves modal-specific interaction and overflow complexity for a form that is substantial enough to deserve its own page.

## Interaction

- The Projects page's primary action and empty-state action navigate to `/projects/new`.
- The new page provides a back link to `/projects`.
- Successful creation navigates to `/projects/:projectId` using the response project id.
- Blank names are ignored, matching the current behavior.
