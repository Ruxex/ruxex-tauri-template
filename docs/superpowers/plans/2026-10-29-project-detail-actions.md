# Project Detail Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロジェクト詳細画面のパンくず・用語を整え、プロジェクト編集と削除を可能にする。

**Architecture:** `BrowserNavigationBar` が詳細ルートの `projectId` を使ってプロジェクト名を取得し、`Projects > プロジェクト名` を表示する。`ProjectHomePage` は既存の作成ダイアログと同じ画面内ダイアログ方式で編集・削除を提供し、App Server の既存APIを包むReact Query mutation hookを利用する。

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Vitest, Testing Library, TypeScript, Tailwind/DaisyUI

**Spec:** `docs/superpowers/specs/2026-10-29-project-detail-actions-design.md`

## Global Constraints

- 用語変更はプロジェクト詳細画面内に限定し、サイドバー等の他画面の `task` 表記は変更しない。
- 編集は `project/update`、削除は `project/delete` の既存App Server APIを使用する。
- 編集・削除失敗時は詳細画面にエラーを表示し、画面を維持する。
- 編集成功後は詳細クエリを更新し、削除成功後はプロジェクト一覧クエリを更新して `/projects` へ戻る。

## Review Focus

- プロジェクト名にHTML特殊文字や長い文字列が含まれる場合も、Reactの通常テキスト表示とtruncateで安全に表示する。
- `project/read` が遅延または失敗した場合、パンくずは壊れず、既存の詳細エラー状態を維持する。
- 編集ダイアログの空白だけの名前は送信せず、入力済みのルートを失わない。
- 削除mutationが失敗した場合、確認ダイアログを閉じずにエラーを表示する。
- ルート未設定プロジェクトの編集で、空のroots配列を正しく `project/update` に渡す。

---

### Task 1: プロジェクト更新・削除mutation hook

**Files:**
- Modify: `src/app-server/hooks/useProjects.ts`
- Test: `src/app-server/hooks/useProjectsHooks.test.tsx`

**Interfaces:**
- Consumes: generated `v2.ProjectUpdateParams` / `v2.ProjectDeleteParams` and `requestAppServerMethod`.
- Produces: `useUpdateProject()` and `useDeleteProject()` mutations exported through the existing `useProjects` barrel; update invalidates the selected project and project collection, delete invalidates the project collection.

- [ ] **Step 1: Write the failing tests**

  Add tests that call `useUpdateProject().mutateAsync({ projectId, name, roots })` and assert `project/update`, and call `useDeleteProject().mutateAsync({ projectId })` and assert `project/delete`. Add invalidation assertions for the detail/collection keys and collection key respectively.

- [ ] **Step 2: Run the hook tests and verify they fail**

  Run: `pnpm vitest run src/app-server/hooks/useProjectsHooks.test.tsx`
  Expected: FAIL because the new hooks are not exported.

- [ ] **Step 3: Implement the minimal hooks**

  Add the two `useMutation` wrappers in `useProjects.ts`, using the exact generated params and invalidating `appServerQueryKeys.project(params.projectId)` plus `appServerQueryKeys.projects` for update, and `appServerQueryKeys.projects` for delete.

- [ ] **Step 4: Run the hook tests and verify they pass**

  Run: `pnpm vitest run src/app-server/hooks/useProjectsHooks.test.tsx`
  Expected: PASS with all project hook tests passing.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app-server/hooks/useProjects.ts src/app-server/hooks/useProjectsHooks.test.tsx
  git commit -m "feat(desktop): add project update and delete hooks"
  ```

### Task 2: プロジェクト名付きパンくず

**Files:**
- Modify: `src/components/layout/BrowserNavigationBar.tsx`, `src/components/layout/AppLayout.tsx`
- Test: `src/components/layout/BrowserNavigationBar.test.tsx`, `src/components/layout/AppLayout.test.tsx`

**Interfaces:**
- Consumes: `AppLayout`'s current `projectId` route param and `useProject` result.
- Produces: a shared breadcrumb rendering `Projects` linked to `/projects`, followed by the loaded project name for `/projects/:projectId`.

- [ ] **Step 1: Write the failing tests**

  Add a breadcrumb test for `/projects/project-1` with `projectTitle="Ruxex"`, asserting the `Projects` link and `Ruxex` current crumb. Add an `AppLayout` test fixture for a project route that asserts `useProject("project-1")` is used and the project name is passed to the navigation bar.

- [ ] **Step 2: Run the layout tests and verify they fail**

  Run: `pnpm vitest run src/components/layout/BrowserNavigationBar.test.tsx src/components/layout/AppLayout.test.tsx`
  Expected: FAIL because the project breadcrumb is currently only `Project` and `AppLayout` does not provide a project title.

- [ ] **Step 3: Implement the minimal breadcrumb data flow**

  Extend `BrowserNavigationBar` with an optional `projectTitle`, return the two crumb entries for `/projects/:projectId`, and have `AppLayout` read the route `projectId`, query `useProject`, and pass the loaded name with a safe fallback such as `Project`.

- [ ] **Step 4: Run the layout tests and verify they pass**

  Run: `pnpm vitest run src/components/layout/BrowserNavigationBar.test.tsx src/components/layout/AppLayout.test.tsx`
  Expected: PASS with existing navigation tests preserved.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/layout/BrowserNavigationBar.tsx src/components/layout/BrowserNavigationBar.test.tsx src/components/layout/AppLayout.tsx src/components/layout/AppLayout.test.tsx
  git commit -m "feat(desktop): show project names in breadcrumbs"
  ```

### Task 3: 詳細画面のチャット用語・編集・削除UI

**Files:**
- Modify: `src/pages/ProjectHomePage.tsx`
- Test: `src/pages/ProjectHomePage.test.tsx`

**Interfaces:**
- Consumes: `useUpdateProject()` and `useDeleteProject()` from Task 1, existing project/thread query data, and Tauri folder picker behavior used by `ProjectsPage`.
- Produces: `New chat`, `Chats`, and chat-specific empty copy; `Edit project` opens a dialog for name/root and submits trimmed values; `Delete project` confirms and navigates to `/projects` on success.

- [ ] **Step 1: Write the failing tests**

  Add test fixtures for update/delete hooks and folder selection. Test chat copy and the two action buttons; test editing name and root calls `mutate` with trimmed values and empty roots when cleared; test blank names do not submit; test deletion calls the mutation and navigates to `/projects` on success; test mutation errors remain visible.

- [ ] **Step 2: Run the page tests and verify they fail**

  Run: `pnpm vitest run src/pages/ProjectHomePage.test.tsx`
  Expected: FAIL because the page currently has task copy, no edit/delete buttons, and no mutations.

- [ ] **Step 3: Implement the minimal page behavior**

  Add the edit and delete state/dialogs, use the existing folder picker API and error formatter, wire update/delete mutation callbacks, and keep the page mounted on mutation failures. Use `useNavigate()` for successful deletion and preserve current project/thread loading/error behavior.

- [ ] **Step 4: Run the page tests and verify they pass**

  Run: `pnpm vitest run src/pages/ProjectHomePage.test.tsx`
  Expected: PASS with all page tests passing.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/ProjectHomePage.tsx src/pages/ProjectHomePage.test.tsx
  git commit -m "feat(desktop): add project detail actions"
  ```

### Task 4: 全体検証

**Files:**
- Verify: all files changed by Tasks 1–3

- [ ] **Step 1: Run targeted tests**

  Run: `pnpm vitest run src/app-server/hooks/useProjectsHooks.test.tsx src/components/layout/BrowserNavigationBar.test.tsx src/components/layout/AppLayout.test.tsx src/pages/ProjectHomePage.test.tsx`
  Expected: PASS with 0 failed tests.

- [ ] **Step 2: Run the complete frontend checks**

  Run: `pnpm check && pnpm test`
  Expected: typecheck, lint, and the complete Vitest suite exit successfully with 0 failures.

- [ ] **Step 3: Review the diff**

  Run: `git diff main...HEAD --check && git status --short`
  Expected: no whitespace errors; only the intended design, plan, implementation, and test files are changed.

- [ ] **Step 4: Commit verification artifacts if needed**

  No additional commit is expected unless formatting changes are required by the checks.
