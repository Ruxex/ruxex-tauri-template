# Chat Index Design

## Intent

Add a dedicated page for finding and browsing active chats, with project-unassigned chats as its primary purpose. The sidebar remains a compact quick-access surface: recent chats and search results show at most eight entries. A new **Chats** item in the left navigation opens the full list.

## Goals

- Make every non-archived chat reachable without expanding the sidebar list.
- Put project-unassigned chats first and make them the default view.
- Separate unassigned and project-assigned chats into tabs so project chats cannot bury unassigned chats.
- Search chats through the App Server search API and sort them using supported API sort keys.
- Keep quick access bounded to eight results and eight recent chats.
- Load all result pages for the full page; do not expose pagination controls solely because the API is cursor-based.
- Provide a direct path from sidebar search to the full page with the search term preserved.

## Non-goals

- Change archived-chat behavior or combine archived and active chats; `/archive` remains the archive surface.
- Add pagination controls to the sidebar.
- Change project list or per-project chat list behavior in this feature.
- Add client-side sorting when the API does not support the requested sort.

## Navigation and page behavior

- Add **Chats** to the primary left rail between Home and Projects. It navigates to `/chats`.
- The Chats route uses the existing Home quick-access sidebar: New chat, search, eight recent chats, and project shortcuts. Selecting Chats must not show the generic “Open Chats” route panel or hide the sidebar.
- The main page is an active-chat index with two tabs: **Unassigned** and **In projects**. **Unassigned** is selected by default and lists only active interactive threads whose `projectId` is null. **In projects** lists active interactive threads with a project assignment. Archived threads remain on `/archive`. Subagent threads stay in the parent thread's Subagents section rather than being mixed into the chat index.
- The page displays each thread's title or fallback, preview, project label when available, status, and last activity.
- The default ordering is most recently active. A control offers the supported API orderings: most recently active, recently updated, and newest created.
- The search uses `thread/search`; the empty-query list uses `thread/list`. Both are restricted to non-archived interactive threads and use the chosen supported ordering. This matches the current API default for normal chat lists.
- The page consumes all cursor pages and renders the complete result set. It does not add a Load more or numbered-pagination control. If rendering cost becomes material at real data sizes, virtualization can be evaluated separately.
- Page search is scoped to the selected tab. Search term is stored in the URL so the result view can be opened directly and restored on navigation.
- The sidebar search request and rendered results are capped at eight. When there are more results, show a **View all results** link to `/chats` with the current search term and `scope=all`.
- The sidebar search is global across both tabs. Its **View all results** link opens a global search result view using `?q=<term>&scope=all`; clearing that query removes `scope=all` and returns the page to the default **Unassigned** tab.

## List scope and API behavior

- `thread/list` supports `projectId: null` for the Unassigned tab. The In projects tab loads active threads and filters out rows without a project assignment while preserving API order.
- `thread/search` has no project filter. For page search in either tab, drain all matching API cursor pages, then filter by `thread.projectId`; do not client-sort the results.
- For the global sidebar handoff (`scope=all`), display all matching active interactive results without a tab filter.
- Keep the selected tab local to the page; URL query parameters are reserved for search and the global sidebar handoff.
- The UI fixtures capture both tabs with ordinary and large data, plus the global sidebar search handoff.

## List organization approaches

1. **Two scope tabs (selected):** default to Unassigned and switch to In projects when needed. This keeps the main value visible regardless of project-chat volume; it does require switching tabs to browse both groups.
2. **One list with unassigned chats pinned first:** both groups remain visible together, but a large project-chat set can still push the primary unassigned list below the fold.
3. **One list with separate sections:** both groups are visible in one scroll area, but the project section adds page length and can distract from the unassigned-first use case.

## API and implementation notes

- `ThreadListParams` supports `cursor`, `limit`, `sortKey`, `sortDirection`, `archived`, and `searchTerm`.
- `ThreadSearchParams` supports `cursor`, `limit`, sort keys for created/updated/recency, and an `archived` filter, but does not support project filtering.
- Existing `useThreadSearch` has a fixed 50-result query and does not consume `nextCursor`; the implementation should support both the sidebar's eight-result preview and complete page search without sharing the sidebar limit.
- `ProjectsPage` and per-project chat-list changes are separate follow-up work.

## Approaches considered

1. **Add Chats to the left rail (selected).** Directly discoverable from every route and provides a clear destination for the sidebar's bounded quick access.
2. **Link from the Recent chats heading only.** Keeps the rail smaller, but makes the full list less discoverable and dependent on opening the Home/Projects context panel.
3. **Link from the Home page.** Easy to find only when starting at Home and does not provide consistent access elsewhere.

The left-rail entry was selected. It is a global destination; the sidebar remains a contextual quick-access surface. For the main list, separate tabs were selected over a single mixed list with unassigned chats pinned at the top, because tabs keep the primary unassigned view clear regardless of project-chat volume. Page search follows the selected tab; sidebar handoff remains global so existing quick-search results are not silently narrowed.

## Open implementation choices

- The builder may choose the exact row/card layout, icons, and labels, preserving existing chat-row conventions.
- Prefer accessible labeled controls and stable URL query parameters. Do not expose raw cursor values in the URL.
- Use existing query caching and invalidation patterns.
