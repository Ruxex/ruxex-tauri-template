# Shared Chat Sidebar on Home, Account, and Project Routes

## Intent

Home, account, and project routes should expose the same chat-oriented left pane so users can reach recent chats, search, projects, and start a new chat without changing the route context. The `Home` heading is route-specific and should be removed from that shared pane.

## Goals

- Show the existing chat sidebar on the home, account, and project routes.
- Keep the chat pane's behavior and contents identical across those routes.
- Remove the visible `Home` heading above the chat pane.
- Keep the icon rail's route navigation and active state unchanged.

## Non-goals

- Change the contents or behavior of the chat list, search, project links, or settings link.
- Change account or project page content.
- Add a new sidebar data source or duplicate chat-sidebar markup.

## Approach

Reuse the existing `HomeSidebar`/`ChatSidebarSections` path as the shared chat sidebar, renaming its accessible region to `Chat sidebar` and removing only the `SidebarHeader` that renders `Home`. Route selection will render this same sidebar for `home`, `account`, and `projects`; project routes will no longer force the sidebar collapsed or suppress its overlay.

## Constraints

- Work directly on the `main` branch.
- Preserve existing navigation routes and chat/sidebar interactions.
- Add regression tests before production changes and keep accessible names stable and meaningful.
