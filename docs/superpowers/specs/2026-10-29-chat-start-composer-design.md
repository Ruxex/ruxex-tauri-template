# Chat Start Composer Design

## Intent

Make the Let’s get started screen use the same chat input panel as an active
conversation, so users learn one composer and can use the same attachment,
goal, plan, permission, model, effort, and send controls from the first
message onward.

## Scope

- Reuse the shared composer option, permission, and model/effort controls on
  the start screen.
- Preserve project context when a project’s New task action opens the start
  screen.
- Remove the dedicated NewChatPage/form presentation.
- Keep legacy new-chat URLs working by redirecting them to the start screen.

The existing project selector is removed from the start-screen composer; a
project-originated New task action carries its project ID in the URL instead.

## Approaches

1. Keep two forms and visually synchronize them. Rejected because future
   control changes would continue to drift between screens.
2. Make the existing conversation composer create its own thread. Rejected
   because it couples active-thread lifecycle concerns to thread creation.
3. Keep thread creation in `NewChatComposer`, but compose its controls from
   the shared menu/settings components. Chosen because it preserves the
   existing start-thread API while giving both screens one UI contract.

## Behavior

The canonical start route is `/`. Legacy new-chat routes replace-navigate to
`/`, optionally carrying `projectId` as a query parameter. A normal submit
starts a thread and sends the first turn; Plan mode sets the plan trigger, and
Goal mode sets the thread goal instead of starting a turn.
