# Project Create Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the new-project modal with a dedicated `/projects/new` page so the metadata selectors are not constrained by modal scrolling.

**Architecture:** Extract the existing create form into `NewProjectPage`, keep the Projects list page read-only except for navigation, and add the static route before the project-detail route. The new page uses the existing project hooks and metadata field component.

**Tech Stack:** React 19, React Router, TanStack Query, Vitest, Testing Library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-29-project-create-page-design.md`

## Global Constraints

- Preserve the existing project creation request fields and metadata behavior.
- Do not modify the project-edit dialog or project API.
- Use the existing folder picker and project metadata components.

## Review Focus

- Static `/projects/new` must resolve to the create page rather than the `:projectId` detail page — route test in Task 1.
- The list page must no longer render the create form or modal — list test in Task 1.
- Successful creation must navigate using the returned project id — create-page test in Task 1.
- Blank project names must not call the mutation — create-page test in Task 1.
- Folder selection and metadata changes must remain in the create request — create-page test in Task 1.

### Task 1: Move project creation to a dedicated page

**Files:**
- Create: `src/pages/NewProjectPage.tsx`
- Create: `src/pages/NewProjectPage.test.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectsPage.test.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `useCreateProject`, `ProjectMetadataFields`, project metadata helpers, and the existing `project/create` response shape `{ project: Project }`.
- Produces: a `NewProjectPage` component and the `/projects/new` route.

- [ ] **Step 1: Write failing tests**

  Add tests that assert the Projects page renders links to `/projects/new` without a form, the router resolves the static route before `:projectId`, and `NewProjectPage` renders the form, preserves metadata/root values in the mutation, rejects a blank name, and navigates to `/projects/:projectId` from the mutation success callback.

- [ ] **Step 2: Run the focused tests and verify they fail for the missing page behavior**

  Run: `pnpm exec vitest run src/pages/ProjectsPage.test.tsx src/pages/NewProjectPage.test.tsx`

  Expected: the new-page import/route behavior fails because the page and route have not been implemented, while failures are unrelated to test syntax.

- [ ] **Step 3: Implement the dedicated page and route**

  Move the create form state and handlers from `ProjectsPage` into `NewProjectPage`. Use a normal page header with a `Link` back to `/projects`; after `mutate` succeeds, navigate to `/projects/${data.project.id}`. Replace the list and empty-state buttons with `Link` elements and register `projects/new` in the router.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `pnpm exec vitest run src/pages/ProjectsPage.test.tsx src/pages/NewProjectPage.test.tsx`

  Expected: all focused tests pass.

- [ ] **Step 5: Run the full verification suite**

  Run: `pnpm test && pnpm typecheck && pnpm lint`

  Expected: all tests pass, TypeScript reports no errors, and Biome/ESLint report no errors or warnings.

- [ ] **Step 6: Commit the implementation**

  ```bash
  git add docs/superpowers/specs/2026-10-29-project-create-page-design.md docs/superpowers/plans/2026-10-29-project-create-page.md src/app/router.tsx src/pages/ProjectsPage.tsx src/pages/ProjectsPage.test.tsx src/pages/NewProjectPage.tsx src/pages/NewProjectPage.test.tsx
  git commit -m "feat(desktop): move project creation to a page"
  ```
