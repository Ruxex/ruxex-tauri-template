# Project List Behavior Design

## Intent

Make the Projects page and each project’s chat list useful as full listing pages. The sidebar remains bounded quick access.

## Selected behavior

- `/projects` loads all `project/list` cursor pages and displays the complete result. It offers the API-supported position and recent-activity ordering. The project-list API has no search parameter, so the page shows all projects without a search field or pagination controls.
- `/projects/:projectId` loads all active `thread/list` cursor pages for the project. It offers API sorting by recent activity, update time, and creation time, and title-substring search through `searchTerm`. It has no pagination controls.
- Keep the sidebar project and chat shortcuts bounded as they are today. The listing pages provide the complete views.
- Verify ordinary and large lists in the existing page-context UI fixtures. Large data crosses the API page boundary for projects and project chats so cursor draining is exercised.

## Approaches

1. **Drain API cursor pages in listing views (selected).** This follows the agreed policy that full listing pages should show all rows when fetching more pages is inexpensive. It avoids making users page through small or moderate data sets while still testing cursor behavior with large fixtures.
2. **Add visible Load more controls to both pages.** This limits initial rendering, but adds interaction and state to pages where API requests are inexpensive and the user asked to show complete data when no project search API exists.
3. **Keep the current fixed limits.** This is appropriate for quick-access sidebar lists, but hides records in the dedicated listing pages.

## Constraints and non-goals

- Do not invent a project-search API or add client-side project filtering.
- Do not change the sidebar’s eight-chat quick-access/search limit.
- Do not change archive or Activity behavior in this follow-up; those surfaces already have different navigation or feed semantics.
- Use App Server results as the authority for ordering and filtering.

## Fixture sizing

- Ordinary data remains 3 projects and 2 chats in `Product planning`.
- Large data uses 120 projects and 60 chats in `Product planning`, crossing the page size used by listing queries.
- Capture top and bottom views for the long project and project-chat lists, plus an ordinary project-chat search result.
