# Shared Page Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use one shared page container for project, capability/plugin, and automation pages so their outer width and vertical spacing are consistent.

**Architecture:** Add a small `PageContainer` React component with a fixed layout contract, then replace only the outer wrapper in the four approved pages. Page-specific headers, controls, cards, and data flows remain inside the shared container unchanged.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-30-page-container-design.md`

## Global Constraints

- The shared outer layout contract is exactly `mx-auto w-full max-w-5xl space-y-6`.
- The scope is `ProjectsPage`, `ProjectHomePage`, `CapabilitiesPage`, and `SchedulesPage`.
- Do not change page-specific headers, actions, cards, data fetching, routing, or inner responsive layouts.
- Do not change unrelated pages such as Account, Settings, Marketplace settings, or New project.
- Preserve existing accessibility and route behavior.

## Review Focus

- The project list must shrink from `max-w-6xl` to the shared `max-w-5xl` without changing its table behavior.
- Automation must use the same `space-y-6` rhythm as the other pages instead of retaining its previous `space-y-8` spacing.
- Project detail and capabilities pages must preserve their existing content while changing only the outer container contract.
- The shared component must render children without adding an extra semantic landmark or altering accessible names.
- Existing page tests and routes must continue to pass after wrapper replacement.

---

### Task 1: Add failing shared-container and page-contract tests

**Files:**
- Create: `src/components/layout/PageContainer.test.tsx`
- Modify: `src/pages/ProjectsPage.test.tsx`
- Modify: `src/pages/ProjectHomePage.test.tsx`
- Modify: `src/pages/CapabilitiesPage.test.tsx`
- Modify: `src/pages/SchedulesPage.test.tsx`

**Interfaces:**
- Consumes: the approved `PageContainer` class contract and current page wrappers.
- Produces: tests that require the shared container and all four page wrappers to use `mx-auto w-full max-w-5xl space-y-6`.

- [ ] **Step 1: Add the failing PageContainer contract test**

Create a jsdom test that renders `<PageContainer><span>content</span></PageContainer>`, asserts the child is present, and asserts the outer element contains `mx-auto`, `w-full`, `max-w-5xl`, and `space-y-6`.

- [ ] **Step 2: Tighten the four existing page wrapper assertions**

Update the four page tests to assert the shared classes. Change the ProjectsPage expectation from `max-w-6xl` to `max-w-5xl`; add `space-y-6` assertions for all four page wrappers.

- [ ] **Step 3: Run the focused tests and verify they fail**

Run: `node_modules/.bin/vitest run src/components/layout/PageContainer.test.tsx src/pages/ProjectsPage.test.tsx src/pages/ProjectHomePage.test.tsx src/pages/CapabilitiesPage.test.tsx src/pages/SchedulesPage.test.tsx`

Expected: FAIL because `PageContainer` does not exist, ProjectsPage still uses `max-w-6xl`, and the page wrappers still use inconsistent spacing.

### Task 2: Implement and adopt PageContainer

**Files:**
- Create: `src/components/layout/PageContainer.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectHomePage.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/SchedulesPage.tsx`

**Interfaces:**
- Consumes: Task 1's failing class-contract and page-wrapper tests.
- Produces: `PageContainer({ children }: PropsWithChildren)` rendering the fixed outer layout contract and four pages using it.

- [ ] **Step 1: Implement `PageContainer`**

Create the component with `PropsWithChildren` and one outer `<div className="mx-auto w-full max-w-5xl space-y-6">` around its children. Do not add extra semantic elements or configurable layout variants.

- [ ] **Step 2: Replace the four page wrappers**

Import `PageContainer` into each approved page and replace only its outer wrapper with `<PageContainer>`. Keep every existing child and page-specific class unchanged.

- [ ] **Step 3: Run focused tests and verify they pass**

Run: `node_modules/.bin/vitest run src/components/layout/PageContainer.test.tsx src/pages/ProjectsPage.test.tsx src/pages/ProjectHomePage.test.tsx src/pages/CapabilitiesPage.test.tsx src/pages/SchedulesPage.test.tsx`

Expected: PASS with all shared-container and page behavior assertions passing.

### Task 3: Verify the complete frontend change

**Files:**
- Verify: `src/components/layout/PageContainer.tsx`
- Verify: `src/pages/ProjectsPage.tsx`
- Verify: `src/pages/ProjectHomePage.tsx`
- Verify: `src/pages/CapabilitiesPage.tsx`
- Verify: `src/pages/SchedulesPage.tsx`

**Interfaces:**
- Consumes: Task 2's shared container implementation.
- Produces: verified frontend changes ready for integration.

- [ ] **Step 1: Run type checking, linting, full tests, and build**

Run the pinned-runtime TypeScript check, Biome, ESLint, full Vitest suite, and Vite build. Expected: exit code 0, no lint errors, and all tests passing.

- [ ] **Step 2: Run whitespace and diff review**

Run: `git diff --check` and inspect the final diff. Expected: only the PageContainer, four approved pages, their tests, and the design/plan documents are changed.
