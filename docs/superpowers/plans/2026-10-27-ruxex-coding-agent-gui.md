# Ruxex Coding Agent GUI Implementation Plan

> 1〜4の実装は [Ruxex GUI基盤 1〜4 設計・実装ドキュメント](../../ruxex-gui-foundation-1-4.md) の簡略化された確定スコープを優先する。この計画のTask 1〜4にあるChecks、Pinned、Active tasks専用セクション、複雑なProject overviewは初期実装には含めない。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在のTauri UIを、特定プロバイダーに依存しないコーディングエージェントの司令塔として、Project・Task・Activity・Worktree・Reviewを中心に再構成する。

**Architecture:** 既存のReact Router、TanStack Query、App Serverイベントストア、Project/Thread/Worktree APIを維持し、表示モデルとレイアウトを段階的に追加する。ThreadをTaskの実体として扱い、ライブ状態は`useAppServerEvents()`から補完する。プロバイダー・モデル・App Server実行方式は主画面から分離し、Settingsの抽象設定として残す。

**Tech Stack:** React 19、TypeScript、React Router、TanStack Query、Vitest、Testing Library、Tailwind CSS / daisyUI、Tauri、Rust App Server

**Spec:** `docs/chatgpt-desktop-gui-spec.md`

## Global Constraints

- Ruxexはプロバイダーフリーであり、OpenAI、ChatGPT、Codex、特定モデル名を主UIの概念・ラベル・アイコンにしない。
- ChatGPT / Workの切替、Voice、Apps、Library、Canvas、Sites、クラウド同期などのChatGPT固有機能は実装対象外とする。
- 会話・タスク一覧、Project、Task headerにはモデル名・プロバイダー名を表示しない。
- Daemon / InProcessはプロダクトモードではなく、Settings > RuntimeのApp Server設定として扱う。
- 既存のApp Server API、Threadイベント、Worktree機能、権限・承認フローを再利用し、不要なバックエンドAPIの重複を作らない。
- UI変更はテスト先行で行い、各タスクの対象テストを先に失敗させてから実装する。
- 本計画の作成時点ではコミットしない。コミットは別途明示的に依頼された場合だけ行う。

## Review Focus

- ProjectやWorktreeが未設定でも、New taskとTask headerが破綻しないこと。Task 2で未指定ケースをテストする。
- `queued`、`running`、`waiting`、`review`、`completed`、`failed`、`cancelled`の全状態が判別できること。Task 1で状態ラベルをテストする。
- App Server切断・再接続中に、実行中Taskが誤って完了扱いにならないこと。Task 5でイベント状態をテストする。
- Worktreeが存在しない、複数ある、dirtyである場合に表示が壊れないこと。Task 4とTask 6でテストする。
- 狭い画面、キーボード操作、長いタスク名、Provider/Model情報が欠落したレスポンスでも操作可能であること。Task 3とTask 7でテストする。

## File Map

- `src/components/sidebar/ThreadList.tsx` / `src/components/common/ThreadCard.tsx`: Task一覧の表示。
- `src/components/tasks/`: Task status、Task row、検索・整理UIの境界。
- `src/components/layout/AppLayout.tsx` / `src/components/sidebar/ProjectSidebar.tsx` / `src/components/sidebar/HomeSidebar.tsx`: アプリshellとサイドバー。
- `src/pages/ProjectsPage.tsx` / `src/pages/ProjectHomePage.tsx`: Project overview。
- `src/components/conversation/ConversationWorkspace.tsx` / `src/components/conversation/ActivityItem.tsx`: Task workspaceとActivity。
- `src/components/approvals/ApprovalCenter.tsx` / `src/components/approvals/ServerRequestCard.tsx`: 承認要求。
- `src/components/settings/SettingsCards.tsx` / `src/components/sidebar/SettingsSidebar.tsx`: Runtime、Connections、Permissionsなどの設定導線。
- `src/app-server/hooks/` / `src/app-server/event-reducer.ts` / `src/app-server/query-keys.ts`: 既存データ取得とライブ状態。

### Task 1: Task表示モデルと一覧行を作る

**Files:**
- Create: `src/components/tasks/task-status.ts`
- Create: `src/components/tasks/TaskListItem.tsx`
- Test: `src/components/tasks/task-status.test.ts`
- Test: `src/components/tasks/TaskListItem.test.tsx`
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/components/common/ThreadCard.tsx`
- Test: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- `task-status.ts` produces `type TaskStatus = "queued" | "running" | "waiting" | "review" | "completed" | "failed" | "cancelled"` and `taskStatusLabel(status: TaskStatus): string`.
- `TaskListItem` consumes the existing `v2.Thread` summary plus optional `TaskStatus`, `projectName`, and `worktreeLabel`; it renders title、status、timestamp without model/provider fields.
- `ThreadList` and `ThreadCard` use the shared rendering contract so sidebar and Project overview do not diverge.

- [ ] **Step 1: Write failing tests** for every status label, long-title truncation, missing name/preview fallback, and absence of model/provider text.
- [ ] **Step 2: Run focused tests.**

Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/tasks/task-status.test.ts src/components/tasks/TaskListItem.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

Expected: FAIL because the task status module and shared list item do not exist and the current non-compact card still renders the model.

- [ ] **Step 3: Implement the status module and shared `TaskListItem`** with stable status text, accessible badges, and no provider/model rendering.
- [ ] **Step 4: Replace duplicated list markup** in `ThreadList` and `ThreadCard`, preserving links, selection, compact mode, empty state, and loading/error behavior.
- [ ] **Step 5: Run the focused tests again** and confirm PASS.

### Task 2: New task flow and Project selectorを整理する

**Files:**
- Create: `src/components/tasks/ProjectSelector.tsx`
- Create: `src/components/tasks/ProjectSelector.test.tsx`
- Modify: `src/components/chat/NewChatComposer.tsx`
- Modify: `src/pages/NewChatPage.tsx`
- Modify: `src/pages/ProjectHomePage.tsx`
- Test: `src/pages/NewChatPage.test.tsx`
- Test: `src/pages/ProjectHomePage.test.tsx`

**Interfaces:**
- `ProjectSelector` consumes `useProjectList()` data and emits `onProjectChange(projectId: string | null)`.
- New task creation continues to use the existing App Server thread mutation; Project、root、worktree、prompt remain the user-facing context fields.
- Existing `/chat/new` and `/projects/:projectId/chat/new` routes remain valid; coding-agent UI labels may change from chat to task.

- [ ] **Step 1: Write failing tests** for a task with no Project, a Project-selected task, and Project overview navigation to New task.
- [ ] **Step 2: Run `src/pages/NewChatPage.test.tsx` and `src/pages/ProjectHomePage.test.tsx`** and verify the expected failures.
- [ ] **Step 3: Add `ProjectSelector`** with an explicit “No project” option and loading/error/empty states.
- [ ] **Step 4: Integrate Project and workspace context** into the existing composer without making Provider/Model required inputs.
- [ ] **Step 5: Rename visible action labels** from “New chat” to “New task” in coding-agent navigation while keeping route compatibility.
- [ ] **Step 6: Run focused page tests** and confirm PASS.

### Task 3: Task-oriented sidebar shellとresponsive behavior

**Files:**
- Create: `src/components/tasks/TaskSidebarSections.tsx`
- Create: `src/components/tasks/TaskSidebarSections.test.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/sidebar/HomeSidebar.tsx`
- Modify: `src/components/sidebar/RouteSidebar.tsx`
- Modify: `src/components/sidebar/navigation.ts`
- Modify: `src/styles/index.css`
- Test: `src/components/layout/AppLayout.test.tsx`
- Test: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- `TaskSidebarSections` consumes active/pinned/recent/project task data and emits `onSelectTask`, `onSelectProject`, `onOpenSearch`, and `onCreateTask` callbacks.
- `ProjectSidebar` keeps the existing `activePanel`, `collapsed`, `selectedThreadId`, `onPanelChange`, and `onToggle` contract until callers are migrated.
- `AppLayout` remains the route shell and owns sidebar open/close state through `useUiPreferences()`.

- [ ] **Step 1: Write failing UI tests** for the section order `Search tasks`, `New task`, `Pinned`, `Active tasks`, `Recent tasks`, `Projects`, optional `Schedules / Skills`, and bottom `Settings`.
- [ ] **Step 2: Run layout/sidebar tests** and verify failure against the icon-rail-first layout.
- [ ] **Step 3: Implement the task-oriented section component** while retaining route navigation for Projects, Schedules, Skills, Account, and Settings.
- [ ] **Step 4: Add compact/floating behavior** at the existing responsive breakpoint; selecting a task or pressing Escape closes the overlay on narrow widths.
- [ ] **Step 5: Add keyboard labels and focus-visible styles** for Search, New task, sidebar toggle, and Close.
- [ ] **Step 6: Run layout/sidebar tests and Biome** and confirm PASS.

### Task 4: Project overviewを開発作業のホームに拡張する

**Files:**
- Create: `src/components/projects/ProjectTaskSections.tsx`
- Create: `src/components/projects/ProjectTaskSections.test.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectHomePage.tsx`
- Modify: `src/components/projects/WorktreeCard.tsx`
- Modify: `src/app-server/hooks/useProjects.ts`
- Modify: `src/app-server/query-keys.ts`
- Test: `src/pages/ProjectsPage.test.tsx`
- Test: `src/pages/ProjectHomePage.test.tsx`

**Interfaces:**
- Project overview consumes existing `useProject`, `useProjectThreads`, and `useWorktrees` data.
- `ProjectTaskSections` receives `activeThreads`, `recentThreads`, and `worktrees`, rendering Active tasks、Recent tasks、Worktrees、Checks without assuming a provider.
- New query helpers use the existing `appServerQueryKeys.projectList`, `project`, and `threadList` conventions.

- [ ] **Step 1: Write failing tests** for empty Project, one active task, multiple worktrees, dirty worktree, and no configured root.
- [ ] **Step 2: Run Project page tests** and verify failures.
- [ ] **Step 3: Split the Project page** into header, task sections, worktrees, and project actions while preserving project creation and folder selection.
- [ ] **Step 4: Add Project actions** for New task, Manage roots, Open folder, and Settings.
- [ ] **Step 5: Use `TaskListItem` for Project task rows** and run focused tests.

### Task 5: Task workspaceとActivity表示を統合する

**Files:**
- Create: `src/components/tasks/TaskHeader.tsx`
- Create: `src/components/tasks/TaskHeader.test.tsx`
- Create: `src/components/tasks/TaskActivityTimeline.tsx`
- Create: `src/components/tasks/TaskActivityTimeline.test.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ActivityItem.tsx`
- Modify: `src/app-server/event-reducer.ts`
- Test: `src/components/conversation/ConversationWorkspace.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Test: `src/app-server/event-reducer.test.ts`

**Interfaces:**
- `TaskHeader` consumes `thread`, `liveThread`, and `pendingRequestCount`; it emits `onStop`, `onResume`, `onOpenReview`, and `onOpenTerminal`.
- `TaskActivityTimeline` consumes existing `LiveConversationItem[]` and event history, rendering summary-first expandable entries.
- `event-reducer.ts` remains the source of truth for `activeTurnId`, live status, completed turn, pending requests, and reconnect state.

- [ ] **Step 1: Write failing tests** for all seven statuses, reconnecting active threads, command/file-change/test activities, and pending approval count.
- [ ] **Step 2: Run focused event and conversation tests** and verify failures.
- [ ] **Step 3: Implement `TaskHeader`** with status badge, Project/worktree context, Run/Stop/Resume, Review, and Terminal actions.
- [ ] **Step 4: Implement `TaskActivityTimeline`** with collapsed summaries and accessible expansion for command, file, test, decision, approval, and failure events.
- [ ] **Step 5: Integrate header and timeline** into `ConversationWorkspace` without changing message merge semantics.
- [ ] **Step 6: Verify reconnect and pending-request behavior** with event reducer and UI tests.

### Task 6: Review / Terminal / FilesをTaskから開く

**Files:**
- Create: `src/components/review/ReviewWorkspace.tsx`
- Create: `src/components/review/ReviewWorkspace.test.tsx`
- Create: `src/components/tasks/TaskContextPanel.tsx`
- Create: `src/components/tasks/TaskContextPanel.test.tsx`
- Modify: `src/components/conversation/ReviewControls.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/projects/WorktreeCard.tsx`
- Modify: `src/app/router.tsx`
- Test: related Thread page UI tests

**Interfaces:**
- `ReviewWorkspace` consumes `threadId`, changed-file metadata, review status, and check results; it renders file tree, diff, findings, and next actions.
- `TaskContextPanel` switches among `review`, `terminal`, and `files` without losing the active thread route.
- Existing `useStartReview`, Worktree APIs, and Tauri terminal/file opening APIs are reused; no provider-specific review flow is added.

- [ ] **Step 1: Write failing tests** for no changes, changed files, review in progress, review failure, clean/dirty worktree, and terminal/file switching.
- [ ] **Step 2: Run focused review/worktree tests** and verify failures.
- [ ] **Step 3: Implement `ReviewWorkspace`** with changed-files tree, diff area, checks, worktree/branch information, and Continue / Apply / Commit / Open terminal actions.
- [ ] **Step 4: Add Task context-panel routing** and expose Review from `TaskHeader` and `ReviewControls`.
- [ ] **Step 5: Keep commit/push as explicit actions** with result feedback and no automatic external mutation.
- [ ] **Step 6: Run review, worktree, and conversation tests** and confirm PASS.

### Task 7: Search、Pinned、Archiveと設定の抽象化

**Files:**
- Create: `src/components/tasks/TaskSearchDialog.tsx`
- Create: `src/components/tasks/TaskSearchDialog.test.tsx`
- Create: `src/components/tasks/task-organizer.ts`
- Test: `src/components/tasks/task-organizer.test.ts`
- Modify: `src/pages/ThreadsPage.tsx`
- Modify: `src/pages/ArchivePage.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/pages/ThreadsPage.test.tsx`
- Test: `src/pages/ArchivePage.test.tsx`
- Test: `src/components/settings/SettingsLayout.test.tsx`

**Interfaces:**
- `TaskSearchDialog` consumes `useThreadSearch(searchTerm)` and emits a selected `threadId`.
- `task-organizer.ts` provides pure grouping/filtering functions for `pinned`, `active`, `recent`, and `archived` collections; it must not depend on React or a provider.
- Settings keeps existing Runtime/App Server controls, but navigation follows `General`, `Runtime`, `Connections`, `Models / Engines`, `Permissions`, `Skills`, `Schedules`, and `About`.

- [ ] **Step 1: Write failing tests** for search by title/body, empty search, pinned and archived grouping, missing provider/model data, and Runtime navigation.
- [ ] **Step 2: Run focused search/archive/settings tests** and verify failures.
- [ ] **Step 3: Implement the search dialog** with keyboard focus, Escape close, result selection, loading, error, and empty states.
- [ ] **Step 4: Implement pure task grouping helpers** and use them in sidebar, Threads, and Archive pages.
- [ ] **Step 5: Reorganize Settings navigation** without moving Daemon/InProcess behavior out of Runtime.
- [ ] **Step 6: Run focused tests** and verify no model/provider names appear in primary task UI.

### Task 8: 全体検証とUI回帰確認

**Files:**
- Modify: relevant test files from Tasks 1-7 only when a regression is found
- Test: all frontend tests, lint/type checks, and Rust tests

- [ ] **Step 1: Run the full frontend test suite.**

Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run`

Expected: all test files and tests pass.

- [ ] **Step 2: Run TypeScript, Biome, ESLint, and diff checks.**

Run:

```bash
/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit
PATH=/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node_modules/.bin/biome lint .
/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js src --max-warnings 0
git diff --check
```

- [ ] **Step 3: Run Rust formatting and tests** because the UI depends on App Server and Worktree behavior.

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 4: Manually verify the acceptance checklist** at wide and narrow viewport widths: create task, select Project, run/stop, approval wait, review, worktree, search, archive, Runtime settings, and no model/provider text in primary UI.

## Handoff

この計画は、`docs/chatgpt-desktop-gui-spec.md`の実装計画である。実装を開始する場合は、各Taskを順番に進め、独立したテストサイクルを完了させる。本依頼ではコミットは作成しない。
