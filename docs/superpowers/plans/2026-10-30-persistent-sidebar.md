# Persistent left sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** すべてのページで左アイコンレールを表示し、ページに不要な右コンテキストペインだけを非表示にする。

**Architecture:** `AppLayout` は `ProjectSidebar` を常に描画し、ルート判定から `showContextPanel` を渡す。`ProjectSidebar` は左レールを常に描画し、右ペインが表示されない場合は折りたたみ状態と同じ 4rem 幅にする。

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-30-persistent-sidebar-design.md`

## Global Constraints

- `ProjectSidebar` は `/projects`、`/projects/:projectId`、`/settings/account` を含む全ルートで描画する。
- `/projects*` と `/settings/account` では左アイコンレールだけを表示し、右コンテキストペインは表示しない。
- その他のルートでは現在の `sidebarCollapsed` に応じた左レール・右ペインの表示を維持する。
- プロジェクト・アカウントページでは、右ペインがないためサイドバー用オーバーレイも表示しない。
- 左レールのアイコン、順序、クリック遷移は変更しない。

## Review Focus

- `/projects` と `/projects/:projectId`: 左レールがあり、右ペインがなく、幅が 4rem であること（Tasks 1–3）。
- `/settings/account`: プロジェクト系ページと同じく左レールだけが残ること（Task 1）。
- 通常ページ: 右ペインとオーバーレイの従来表示が維持されること（Task 1）。
- `sidebarCollapsed` が false でも右ペイン非表示ページでは左レールが広がらないこと（Task 2）。
- 左レールのナビゲーション操作・アイコン表示が既存どおりであること（Task 2）。

### Task 1: Define page-level sidebar visibility with failing layout tests

**Files:**
- Modify: `src/components/layout/AppLayout.test.tsx`

**Interfaces:**
- Consumes: Existing `AppLayout` route and mocked `ProjectSidebar` props.
- Produces: Regression coverage for always-rendered left rail, page-specific context visibility, and preserved normal-page behavior.

- [ ] **Step 1: Write the failing tests**

  Update the project/account route test to assert that `project-sidebar` exists instead of being absent, and assert that the captured `ProjectSidebar` props contain `showContextPanel: false`. Keep the assertion that no overlay is rendered.

  Add or update a normal-route assertion that `showContextPanel` is true when the sidebar is not collapsed.

- [ ] **Step 2: Run the focused layout test to verify the failure**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/layout/AppLayout.test.tsx`

  Expected: FAIL because `AppLayout` currently omits `ProjectSidebar` entirely on project/account routes and does not pass `showContextPanel`.

### Task 2: Define collapsed rail behavior with failing sidebar tests

**Files:**
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- Consumes: `ProjectSidebar` with the new optional `showContextPanel` prop.
- Produces: Regression coverage for a visible rail with no context panel and compact width.

- [ ] **Step 1: Write the failing test**

  Add a test rendering `ProjectSidebar` with `collapsed={false}` and `showContextPanel={false}`. Assert that the workspace sidebar and workspace navigation exist, the chat context panel is absent, and the workspace sidebar class contains `workbench-sidebar-collapsed`.

- [ ] **Step 2: Run the focused sidebar tests to verify the failure**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/sidebar/ProjectSidebar.test.tsx`

  Expected: FAIL because `ProjectSidebar` does not accept or use `showContextPanel`, and `collapsed={false}` currently selects the expanded width.

### Task 3: Keep the rail and conditionally render the context panel

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.tsx`

**Interfaces:**
- Consumes: `sidebarPanelForPath(location.pathname)` and `showContextPanel` from `AppLayout`.
- Produces: `ProjectSidebar({ showContextPanel?: boolean })`, defaulting to true for existing direct callers and using a compact rail whenever the context panel is hidden or collapsed.

- [ ] **Step 1: Update `ProjectSidebar`**

  Add optional `showContextPanel = true`. Compute context visibility as `showContextPanel && !collapsed`; use the expanded `w-[22rem]` class only when that value is true, otherwise use `workbench-sidebar-collapsed`. Always render the navigation rail, and render `SidebarContextPanel` only when context visibility is true.

- [ ] **Step 2: Update `AppLayout`**

  Replace the whole-sidebar `hidesSidebar` behavior with a `hidesContextPanel` route decision for `projects` and `account`. Always render `ProjectSidebar` with `showContextPanel={!hidesContextPanel}`. Keep the overlay conditional on `!hidesContextPanel && !preferences.sidebarCollapsed`, so pages without a context panel never show an overlay.

- [ ] **Step 3: Run focused tests to verify the implementation passes**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/layout/AppLayout.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

  Expected: PASS with project/account routes retaining the rail, normal routes retaining the context panel, and compact-width assertions passing.

### Task 4: Run repository verification

**Files:**
- No additional files.

**Interfaces:**
- Consumes: The completed sidebar layout change and regression tests.
- Produces: Fresh typecheck, lint, full test, build, and diff evidence.

- [ ] **Step 1: Run full verification**

  Run in parallel:
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@biomejs/biome/bin/biome lint .`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js src --max-warnings 0`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`
  - `git diff --check`

  Expected: all commands exit 0; the full suite reports zero failures.
