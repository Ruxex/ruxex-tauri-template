# Chat Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Chats page so unassigned active chats are its default view, with a separate project-chat tab and scope-aware search.

**Architecture:** Keep the `/chats` route, Chats rail entry, and Home quick-access sidebar. Split the full page into Unassigned (default) and In projects tabs. Use App Server sorting/search and drain cursor pages; filter project-search results client-side because the search API has no project filter. Preserve global results for the sidebar search handoff.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, App Server `thread/list` and `thread/search`, Tailwind/DaisyUI.

**Spec:** `docs/superpowers/specs/2026-11-14-chat-index-design.md`

## Global Constraints

- The Chats page contains non-archived interactive threads; subagents stay in their parent thread context and archived threads stay under `/archive`.
- Sidebar recent chats and chat-search results each show at most eight entries and do not paginate.
- The full Chats page loads all cursor pages and does not expose pagination controls.
- Use API-supported sort/search; do not add client-only sorting or search.
- Keep the Chats route's existing Home quick-access sidebar visible; do not show the generic route panel.
- Page search follows the selected tab; the sidebar's View all results link opens global search results across both tabs.
- `thread/list` uses `projectId: null` for Unassigned; project-assigned results preserve API order after client filtering.

## Review Focus

- Search result and list query caches must distinguish search term, sort order, archive filter, and page size.
- Cursor draining must stop at `nextCursor === null` and preserve API ordering across pages.
- Sidebar preview must remain capped at eight even when its search API response has a cursor.
- URL search state must survive page reload and sidebar-to-page navigation without exposing opaque cursors.
- A route refresh on `/chats` must resolve through the hash router and select the Chats rail item.
- Switching tabs must separate rows by null versus non-null `projectId` without changing the selected API ordering.
- `scope=all` from sidebar search must show project and unassigned matches; clearing it returns to Unassigned.

## File Structure

- `src/app/router.tsx`: register `/chats`.
- `src/components/sidebar/navigation.ts`: add the Chats rail definition and route matching.
- `src/components/sidebar/RouteSidebar.tsx`: render the existing Home quick-access panel while Chats is active.
- `src/app-server/hooks/useThreadQueries.ts`: expose configurable search/list query helpers with complete cursor loading for page use and an eight-result limit for sidebar use.
- `src/app-server/hooks/useProjects.ts`: provide an all-pages project-list query so project labels remain available beyond the first project page.
- `src/components/chats/ChatSearchBox.tsx`: cap quick-search results at eight and link the current query to `/chats` when more results exist.
- `src/pages/ChatsPage.tsx`: implement the full active-chat index, URL-backed search, and API-backed sort selection.
- `src/pages/ChatsPage.tsx`: add Unassigned / In projects tabs, tab-scoped page search, and the `scope=all` global search state.
- `src/components/chats/ChatSearchBox.tsx`: make the overflow link set `scope=all` so project matches are not hidden by the default tab.
- `fixtures/dummy-home/catalog.ts`, `fixtures/dummy-home/pages.spec.ts`, and `fixtures/dummy-home/large-data.spec.ts`: capture both scopes with ordinary and large data.
- `README.md` and `scripts/ui-fixtures/README.md`: mention the Chats route and its role if those docs describe current page inventory.

## Tasks

### Task 1: Add reusable complete thread-list and search queries

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/app-server/hooks/useProjects.ts`
- Modify: `src/app-server/hooks/index.ts` only if new exports are required

**Interfaces:**
- `useThreadList(params)` remains a one-page query for existing quick-access consumers.
- Add page-oriented list/search hooks or options that return `ThreadListResponse` / `ThreadSearchResponse` data with all cursor pages drained.
- Search params include `searchTerm`, `archived: false`, selected sort key/direction, and a page size; the sidebar caller uses page size `8`.
- Add `useAllProjectList(params)` to return all project pages for the Chats page's thread-to-project labels.

- [x] Implement cursor draining for `thread/list` and `thread/search`, retaining API order and terminating on a null cursor.
- [x] Keep query keys parameterized by sort, filter, and search term so page and sidebar data do not collide.
- [x] Run `make build` and confirm the TypeScript build succeeds.

### Task 2: Add the Chats page and left-rail route

**Files:**
- Create: `src/pages/ChatsPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/components/sidebar/navigation.ts`
- Modify: `src/components/sidebar/RouteSidebar.tsx`

**Interfaces:**
- Route: `/chats`.
- Rail entry: `Chats`, placed between Home and Projects.
- Chat list query: active interactive threads, all cursor pages, default `recency_at desc`.
- Search query: full-text thread search, active interactive threads, all cursor pages.
- Sort choices: `recency_at desc`, `updated_at desc`, `created_at desc`.
- Search URL state: `?q=<term>`; sort state defaults to `recency_at desc` and may remain local to the page.

- [x] Build the page header, URL-backed search, sort control, loading/error/empty states, and all-thread results using current page/list components.
- [x] Render project names and execution state where existing thread/project/event data can supply them; retain a clear fallback when unavailable.
- [x] Add a Chats rail icon/route and map `/chats` to the Chats panel state.
- [x] When Chats is active, reuse `HomeSidebar` instead of the generic route panel; keep its quick-access sections visible.
- [x] Run `make build` and inspect the diff for route and navigation regressions.

### Task 3: Cap sidebar quick access and provide the full-results path

**Files:**
- Modify: `src/components/chats/ChatSearchBox.tsx`
- Modify: `src/components/chats/ChatSidebarSections.tsx` or `src/components/sidebar/ThreadList.tsx` only if the recent-chat limit is not already eight

**Interfaces:**
- Recent chat list remains `limit: 8`.
- Sidebar search sends `limit: 8` and renders no more than eight results.
- The overflow link navigates to `/chats?q=<current search term>` only when more results are available.

- [x] Add the eight-result search limit and render cap.
- [x] Add the accessible **View all results** link when `nextCursor` is non-null, preserving the search term in the URL.
- [x] Keep sidebar search results inside their existing bounded, scrollable region.
- [x] Run `make build` and inspect the final diff.

### Task 4: Make Chats unassigned-first with scope-aware tabs and search

**Files:**
- Modify: `src/pages/ChatsPage.tsx`
- Modify: `src/components/chats/ChatSearchBox.tsx`
- Modify: `fixtures/dummy-home/catalog.ts`
- Modify: `fixtures/dummy-home/pages.spec.ts`
- Modify: `fixtures/dummy-home/large-data.spec.ts`
- Modify: `README.md` and `scripts/ui-fixtures/README.md`

**Interfaces:**
- Tabs: `Unassigned` (default) and `In projects`.
- Unassigned list requests `thread/list` with `projectId: null`.
- In projects list requests the normal active thread list and filters out rows with `projectId === null`, preserving API order.
- Page `q` search is filtered to the selected tab after all `thread/search` cursor pages are loaded.
- Sidebar overflow navigates to `/chats?q=<term>&scope=all`; that query displays matching active threads from both scopes. Clearing `q` also removes `scope=all` and returns to Unassigned.
- Search/sort options remain API-backed; no pagination controls are introduced.

- [x] Add the tabs with Unassigned selected by default; keep list sort order from the API in each tab.
- [x] Scope page search to the selected tab, and implement the explicit global search state for sidebar handoff.
- [x] Add ordinary screenshot captures for both tabs, tab-scoped search, and the global handoff; add large-data top/bottom captures for both tabs.
- [x] Update fixture counts/docs so ordinary and large-data assertions cover assigned and unassigned chats.
- [ ] Run the updated `make ui-fixtures` successfully and inspect the new screenshots. Typecheck, `make build`, and `git diff --check` pass; the UI fixture target currently cannot start reliably while another Ruxex desktop app is active on the same display.

## Verification

- [x] `make build` succeeds.
- [x] `git diff --check` succeeds.
- [x] The prior `make ui-fixtures` run inspected the Chats route, sidebar limit, sort options, search handoff, URL restoration, and active rail state for Tasks 1–3.
- [ ] Capture and inspect the updated Chats tab and search screenshots after the display conflict is cleared.

## Execution Notes

- Do not add or run automated tests unless the user asks for test/verification work.
- Do not add UI pagination controls to `/chats`; cursor pages are an internal transport detail.
