# New chat project selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NewChat の入力パネル直上にプロジェクトセレクタを表示し、選択したプロジェクトを新規スレッド作成へ引き継ぐ。

**Architecture:** `NewChatComposer` が `useProjectList` から選択肢を取得し、`selectedProjectId` をローカル状態として保持する。既存の `ProjectSelector` を form の兄弟要素として同じ幅の上部帯に表示し、選択済みプロジェクトの `useProject` から root を読み込んで既存の thread 作成処理に渡す。

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Tailwind CSS, existing App Server project hooks.

**Spec:** `docs/superpowers/specs/2026-10-30-new-chat-project-selector-design.md`

## Global Constraints

- `NewChatComposer` に既存の `ProjectSelector` を接続する。
- セレクタは NewChat の入力フォーム直上に置き、同じ幅・境界線を共有する帯として表示する。
- URL の `projectId` がある場合は初期選択値にする。
- 選択変更時は選択済みプロジェクトを使い、そのプロジェクトの root をスレッド作成へ渡す。
- 「No project」は維持し、プロジェクトなしの NewChat も開始できるようにする。
- 既存チャットの入力パネルや他ページにはセレクタを表示しない。

## Review Focus

- NewChat のみ: Home の開始画面に表示し、既存チャットの composer を変更しないこと（Task 1）。
- プロジェクトなし: No project のまま送信でき、`projectId` / `cwd` を作成リクエストへ追加しないこと（Task 1）。
- URL 初期値: `/?projectId=project-1` で selector が project-1 を選ぶこと（Task 1）。
- 選択変更: selector の変更後に projectId と選択プロジェクト root が thread 作成へ渡ること（Task 1）。
- レイアウト接続: selector が入力 form より前にあり、上下の境界を共有すること（Task 1）。

### Task 1: Define NewChat project selection behavior with failing UI tests

**Files:**
- Modify: `src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: Existing `HomePage`, `NewChatComposer`, mocked project hooks, and `ProjectSelector` accessibility contract.
- Produces: Regression coverage for selector visibility, initial value, project selection payload, no-project behavior, and attached layout.

- [ ] **Step 1: Write the failing tests**

  Mock `useProjectList` with two projects and add it to the existing App Server hook mock. Add assertions to the welcome test that:
  - the `Project` selector exists only on the NewChat screen;
  - it includes `No project` and project options;
  - its label wrapper precedes the composer form and uses the attached top-border container.

  Extend the project-query test to assert the selector value is `project-1` when the URL contains `?projectId=project-1`.

  Add a test that selects `project-1`, mocks its root as `/workspace/project-alpha`, submits a message, and asserts `useCreateThread().mutateAsync` receives both `projectId: "project-1"` and `cwd: "/workspace/project-alpha"`.

  Keep the existing no-project send test and its exact payload expectations so the selector does not change project-less creation.

- [ ] **Step 2: Run the focused test to verify the failure**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/pages/HomePage.test.tsx`

  Expected: FAIL because `NewChatComposer` currently does not render `ProjectSelector`, does not call `useProjectList`, and does not manage project selection state.

### Task 2: Connect the selector and project context to NewChatComposer

**Files:**
- Modify: `src/components/chat/NewChatComposer.tsx`

**Interfaces:**
- Consumes: `useProjectList`, `useProject`, `ProjectSelector`, and the existing `projectId?: string` prop.
- Produces: NewChat-only project selection UI and thread creation payload using the selected project ID and root.

- [ ] **Step 1: Add project selection state and queries**

  Call `useProjectList()` for selector options. Initialize `selectedProjectId` from `projectId ?? ""`, call `useProject(selectedProjectId)`, and use the selected ID for project loading and submit payloads. Preserve the existing optional-project behavior when the selected value is empty.

- [ ] **Step 2: Render the attached selector panel**

  Import and render `ProjectSelector` immediately before the existing form inside the same `max-w-3xl` wrapper. Pass project list data/loading/error, the selected value, `onChange={setSelectedProjectId}`, and `disabled={isPending}`. Use a top panel with the shared border/background and a form with the shared width and no duplicate top border so the two surfaces read as one attached input panel.

- [ ] **Step 3: Use selected project data when creating the thread**

  Replace the prop-only `projectId` and project query root references in `handleSubmit` with `selectedProjectId` and the selected project data. Keep all existing message, image, Goal, Plan, permission, model, and reasoning behavior unchanged.

- [ ] **Step 4: Run the focused tests to verify the implementation passes**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/pages/HomePage.test.tsx`

  Expected: PASS with all NewChat selector, selection payload, existing send, Goal, Plan, and URL project tests passing.

### Task 3: Run repository verification and publish the change

**Files:**
- No additional files.

**Interfaces:**
- Consumes: The tested NewChat selector implementation and approved design/plan documents.
- Produces: A verified commit pushed to `origin/main`.

- [ ] **Step 1: Run full verification**

  Run in parallel:
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@biomejs/biome/bin/biome lint .`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js src --max-warnings 0`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run`
  - `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`
  - `git diff --check`

  Expected: all commands exit 0; the full suite reports zero failures.

- [ ] **Step 2: Commit only this feature's files**

  Stage `src/components/chat/NewChatComposer.tsx`, `src/pages/HomePage.test.tsx`, `docs/superpowers/specs/2026-10-30-new-chat-project-selector-design.md`, and `docs/superpowers/plans/2026-10-30-new-chat-project-selector.md`, then commit with:

  ```bash
  git commit -m "feat: add project selector to new chat"
  ```

- [ ] **Step 3: Push and verify**

  Run: `git push origin main`

  Expected: push succeeds and `git log -1 --oneline` shows the new commit.
