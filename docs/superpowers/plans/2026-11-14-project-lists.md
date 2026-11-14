# Project Listing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/projects` and `/projects/:projectId` complete API-backed listing pages with supported sorting and project-chat title search.

**Architecture:** Reuse the cursor-draining project and thread hooks for full listing pages. Keep the existing bounded project/thread list helpers for sidebar quick access. Add sort controls to both pages, and wire project detail search to `thread/list.searchTerm`.

**Tech Stack:** React, TypeScript, TanStack Query, Tauri App Server v2, WebdriverIO UI fixtures.

**Spec:** `docs/superpowers/specs/2026-11-14-project-lists-design.md`

## Global Constraints

- Project listing pages fetch all cursor pages and add no visible pagination controls.
- Project search is only available where the App Server API supports it.
- Sidebar quick access remains bounded at eight chats.
- Large fixtures must exercise multiple cursor pages for project and project-chat listing.
- Do not add or run automated tests unless the user asks; run typecheck, build, and the already requested UI fixtures.

## Review Focus

- Cursor requests retain project ID, search term, and sort options across every page.
- Sidebar quick access remains capped and does not inherit full-list behavior.
- Empty and loading states distinguish an empty project from a search with no results.
- Large fixture counts and last-row selectors match the data-generation loops.
- Project position and recency sorting use the App Server’s supported sort keys.

## Task 1: Complete the Projects listing

**Files:** `src/pages/ProjectsPage.tsx`, `src/app-server/hooks/useProjects.ts`, `src/pages/ProjectsPage.test.tsx` only if needed to keep existing mocks aligned.

- [x] Load all project cursor pages with a bounded request size while keeping sidebar uses on the current single-page hook.
- [x] Add API-backed position and recent-activity sort choices.
- [x] Keep the full list visible with no search or pagination controls.

## Task 2: Complete each project’s chat listing

**Files:** `src/pages/ProjectHomePage.tsx`, `src/app-server/hooks/useProjects.ts`, `src/app-server/query-invalidation.ts`, `src/pages/ProjectHomePage.test.tsx` only if needed to keep existing mocks aligned.

- [x] Load every active project chat cursor page, preserving the selected project and sort parameters.
- [x] Add API-backed title search and sort choices for recency, update time, and creation time.
- [x] Keep all matches on the page without pagination controls; show a search-specific empty state.

## Task 3: Exercise ordinary and large list behavior

**Files:** `fixtures/dummy-home/catalog.ts`, `fixtures/dummy-home/large-data.spec.ts`, `fixtures/dummy-home/pages.spec.ts`, `README.md`, `scripts/ui-fixtures/README.md`.

- [x] Expand the large fixture to 120 projects and 60 `Product planning` chats, while preserving 11 unassigned active chats.
- [x] Capture ordinary project chat search and top/bottom views of both large listing pages.
- [x] Update fixture count documentation.

## Verification

- [x] `pnpm typecheck`
- [x] `make build`
- [ ] `make ui-fixtures` (requested page-context screenshots)
- [x] `git diff --check`
- [x] Inspect generated project and project-chat screenshots.

`make ui-fixtures` passed the persistent, pages, unshot, large-data, and volatile UI specs, including every project-listing screenshot. The command then failed in the separate `git-diff-review.spec.ts` scenario because its expected project picker button was absent.
