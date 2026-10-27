# Task Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在の`/chat/:threadId`を、既存の会話機能を維持したままTask Workspaceへ段階的に拡張する。

**Architecture:** `ThreadPage`と`/chat/:threadId`は維持し、`ConversationWorkspace`をTask Workspaceのシェルとして使う。保存済みThread/Turn/Itemは`useThreadConversation()`、ライブ状態とpending requestは`useAppServerEvents()`を正とし、表示モデルを純粋なselectorと小さなUIコンポーネントに分離する。Review、Terminal、Filesは後続TaskのContext panelとして追加し、Provider固有の画面は作らない。

**Tech Stack:** React 19、TypeScript、React Router、TanStack Query、Vitest、Testing Library、Tailwind CSS / daisyUI、Tauri、App Serverイベントストア

**Spec:** `docs/superpowers/specs/2026-10-27-task-workspace-design.md`

## Global Constraints

- `/chat/:threadId`のURLと既存のdeep linkを維持する。
- Ruxexはプロバイダーフリーであり、Task header・Activity summaryにProvider名やModel名を表示しない。
- `event-reducer.ts`をライブ状態の唯一のソースとし、コンポーネントごとに実行状態を複製しない。
- `thread.cwd`をTaskの実効workspaceとして扱い、Project rootは補助コンテキストとして扱う。
- pending approval / user inputはTask画面内でも`ServerRequestCard`を使って操作できるようにする。
- 切断・再接続中のTaskをCompletedと表示しない。
- Commit、Push、外部公開を自動実行しない。
- Checks、CI/CD集約、ChatGPT固有機能は今回の実装対象外とする。
- UI変更はテスト先行で行い、各Taskを独立したコミットとして検証する。

## Review Focus

- 保存済みTurnだけがある履歴Taskでも、completed / failed / stoppedを復元できることをTask 5のselector testで確認する。
- 切断・lagged・再接続中に、直前のTask状態を失わず、Completedへ誤遷移しないことをTask 5のevent-reducer testで確認する。
- pending approval / user inputが対象Taskだけに表示され、別Taskの要求が混ざらないことをTask 5のUI testで確認する。
- thread.cwdがない、Project rootが複数ある、Git branchがない場合でもTask headerが壊れないことをTask 5のheader testで確認する。
- Terminal / Files APIが利用できない環境でもContext panelが壊れず、unsupported状態を表示できることをTask 6のcontext testで確認する。

## File Map

- `src/components/conversation/ConversationWorkspace.tsx`: Task Workspaceのデータ境界とレイアウト。
- `src/components/tasks/TaskHeader.tsx`: Task名、状態、Project/workspace、主要操作。
- `src/components/tasks/TaskActivityTimeline.tsx`: 会話とActivity、pending requestの時系列表示。
- `src/components/tasks/task-workspace-model.ts`: 保存済みThread/Turn/live stateから表示モデルを作る純粋関数。
- `src/components/tasks/TaskContextPanel.tsx`: Review / Terminal / Filesの切り替え境界。
- `src/components/review/ReviewWorkspace.tsx`: Review結果と変更ファイルの表示。
- `src/app-server/event-reducer.ts`: reconnectとlive stateの遷移。
- `src/components/conversation/ActivityItem.tsx`: Activity表示の共通presentation。

### Task 5: Task headerとActivity timelineを統合する

**Files:**
- Create: `src/components/tasks/task-workspace-model.ts`
- Create: `src/components/tasks/task-workspace-model.test.ts`
- Create: `src/components/tasks/TaskHeader.tsx`
- Create: `src/components/tasks/TaskHeader.test.tsx`
- Create: `src/components/tasks/TaskActivityTimeline.tsx`
- Create: `src/components/tasks/TaskActivityTimeline.test.tsx`
- Modify: `src/components/tasks/task-status.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ActivityItem.tsx`
- Modify: `src/app-server/event-reducer.ts`
- Test: `src/components/conversation/ConversationWorkspace.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Test: `src/app-server/event-reducer.test.ts`

**Interfaces:**
- `getTaskWorkspaceStatus(input: TaskWorkspaceStatusInput): TaskWorkspaceStatus`は、保存済みThread status、最新Turn、live Thread、pending request数、reconnecting状態を受け取り、`status?: TaskStatus`と`reconnecting: boolean`を返す。
- `TaskHeader`は`thread`, `latestTurn`, `liveThread`, `pendingRequestCount`, `workspacePath`, `projectName`を受け取り、`onStop`, `onResume`, `onStartReview`をcallbackとして受け取る。Header自身はApp Server mutationを直接呼ばない。
- `TaskActivityTimeline`は`ConversationViewItem[]`、`LiveConversationItem[]`、対象Taskの`PendingServerRequest[]`、`connected`、`onResolve`、`onReject`を受け取り、既存の`ServerRequestCard`と`ActivityItem`を再利用して表示する。

- [ ] **Step 1: 保存済みTurnとlive stateのselectorテストを書く**

  `task-workspace-model.test.ts`で、次を固定する。

  - latest persisted turnが`completed`ならCompleted
  - latest persisted turnが`failed`ならFailed
  - latest persisted turnが`interrupted`ならStopped
  - active flagが承認・入力待ちならWaiting
  - live statusがある場合はpersisted statusより優先
  - reconnectingは`reconnecting: true`になり、Underlying statusをCompletedへ変更しない
  - `thread.cwd`、Project root、branchなしのfallback

- [ ] **Step 2: selectorとevent-reducerのテストを失敗させる**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/components/tasks/task-workspace-model.test.ts src/app-server/event-reducer.test.ts`

  Expected: FAIL because the workspace selector does not exist and reconnect state transition coverage is missing.

- [ ] **Step 3: `task-workspace-model.ts`を実装する**

  保存済みTurnをlive statusのfallbackとして使い、pending requestをWaitingとして扱う。`thread.cwd`をeffective workspaceとして返し、Project rootは別フィールドにする。判定不能な状態は`undefined`にする。

- [ ] **Step 4: reconnect状態の遷移をevent-reducerへ追加する**

  `lagged` / `disconnected`後に通常のserver notificationを受信した場合のresynchronizing解除条件を明確化する。切断直後のactive threadはresynchronizingのまま保持し、接続復旧前にCompletedへ変換しない。

- [ ] **Step 5: `TaskHeader`の失敗テストを書く**

  Task名fallback、Status badge、Project/workspace、branch、Reconnecting、Waiting、Stop、Resume、Reviewの各表示・callbackをテストする。Model/Provider/Internal IDがDOMに存在しないことも確認する。

- [ ] **Step 6: `TaskHeader`を実装する**

  表示とcallbackに限定し、mutationは`ConversationWorkspace`側に保持する。active turnがない場合はStopをdisabledにし、Resumeは再開可能な状態だけ表示する。ReviewはTask 5では既存の`review/start`を開始する。

- [ ] **Step 7: `TaskActivityTimeline`の失敗テストを書く**

  User/Agent message、command、file change、plan、reasoning、tool、pending approval、user input、failureの順序・展開・実行中表示をテストする。対象Task以外のpending requestを表示しないことを確認する。

- [ ] **Step 8: `TaskActivityTimeline`を実装する**

  `mergeConversationItems()`の結果を利用し、既存`ActivityItem`のpresentationを壊さずにpending requestをtimeline内へ追加する。承認・入力のresolve/rejectは既存のserver request APIへ委譲する。

- [ ] **Step 9: `ConversationWorkspace`へ統合する**

  現在のConversation headerをTaskHeaderへ置き換え、Activity表示をTaskActivityTimelineへ移す。Composerの送信・steer・interrupt処理、loading/error境界、既存deep linkは維持する。

- [ ] **Step 10: Task 5を検証してコミットする**

  Run: `vitest`の関連テスト、`tsc --noEmit`、Biome、ESLint、`git diff --check`。

  Commit: `feat: add task workspace header and activity timeline`

### Task 6: Review / Terminal / FilesをTask contextから開く

**Files:**
- Create: `src/components/tasks/TaskContextPanel.tsx`
- Create: `src/components/tasks/TaskContextPanel.test.tsx`
- Create: `src/components/review/ReviewWorkspace.tsx`
- Create: `src/components/review/ReviewWorkspace.test.tsx`
- Modify: `src/components/tasks/TaskHeader.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ReviewControls.tsx`
- Modify: `src/components/projects/WorktreeCard.tsx`
- Modify: `src/app/router.tsx` only if a context deep link is required
- Test: related ConversationWorkspace and ReviewControls tests

**Interfaces:**
- `TaskContextPanel` receives `threadId`, `activeTab: "review" | "terminal" | "files"`, `onClose`, and task/worktree context. Unsupported native capabilities are represented as an explicit empty state, not a broken button.
- `ReviewWorkspace` receives `threadId`, changed-file metadata, review mutation state, and worktree information. It does not assume a Provider or external CI service.
- TaskHeader emits `onOpenContext(tab)`; it does not navigate away from `/chat/:threadId`.

- [ ] **Step 1: Review / context panelの失敗テストを書く**

  変更なし、変更あり、Review開始中、Review失敗、clean/dirty worktree、Terminal/Files非対応の状態をテストする。

- [ ] **Step 2: Review開始結果の既存API境界を確認する**

  `useStartReview()`のresponseと既存event/Threadデータで取得できる情報だけを使う。取得できないDiffやCheckは仮表示せず、未提供状態を表示する。

- [ ] **Step 3: `TaskContextPanel`を実装する**

  DesktopではTask画面内の補助領域、狭い画面ではoverlayとして表示する。Escape、Close、再度のTab選択で閉じられるようにする。

- [ ] **Step 4: `ReviewWorkspace`を実装する**

  Review開始、変更ファイルの概要、worktree/branch、Review結果を表示する。Commit、Push、Applyは実際のAPIが存在する場合だけ明示アクションとして追加し、自動操作はしない。

- [ ] **Step 5: Terminal / Filesの対応を実装または明示的にunsupported表示する**

  既存のTauri native APIやApp Server APIが利用できる場合だけ接続する。APIがない場合は、将来の接続点を残したunsupported stateにする。

- [ ] **Step 6: Task 6を検証してコミットする**

  Conversation、Review、Worktree、responsive UIのテストとfrontend checksを実行する。

  Commit: `feat: add task context panel`

### Task 7: Task検索・整理とSettings導線を拡張する

**Files:**
- Create: `src/components/tasks/TaskSearchDialog.tsx`
- Create: `src/components/tasks/TaskSearchDialog.test.tsx`
- Create: `src/components/tasks/task-organizer.ts`
- Create: `src/components/tasks/task-organizer.test.ts`
- Modify: `src/components/tasks/TaskSidebarSections.tsx`
- Modify: `src/pages/ThreadsPage.tsx`
- Modify: `src/pages/ArchivePage.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/components/settings/SettingsCards.tsx` only for provider-neutral labels
- Test: related sidebar, Threads, Archive, Settings tests

**Interfaces:**
- `TaskSearchDialog` consumes `useThreadSearch(searchTerm)` and emits `onSelect(threadId)`.
- `task-organizer.ts` provides provider-free pure functions for recent, active, pinned, and archived grouping.
- Existing Runtime/App Server controls remain under Settings > Runtime and are not moved into the Task screen.

- [ ] **Step 1: Search and groupingの失敗テストを書く**

  title/body検索、空検索、loading/error/empty、pinned/active/recent/archived grouping、Model/Provider欠落を固定する。

- [ ] **Step 2: `TaskSearchDialog`を実装する**

  Focus、Escape、結果選択、キーボード操作、検索エラーを実装する。選択後は既存の`/chat/:threadId`へ移動する。

- [ ] **Step 3: `task-organizer.ts`を実装する**

  ReactやProviderに依存しない純粋関数として整理する。Task statusはTask 5のselectorを利用し、推測による分類を行わない。

- [ ] **Step 4: Sidebar / Threads / Archiveへ統合する**

  1〜4で作った共通TaskListItemを維持し、Model/Providerを主表示へ戻さない。PinnedやActiveを追加しても、ProjectやSettingsの基本導線を隠さない。

- [ ] **Step 5: Settings導線を整理して検証する**

  General、Runtime、Connections、Models / Engines、Permissions、Skills、Schedules、Aboutの分類を既存ルートに対応付ける。Daemon / InProcessはRuntime設定に残す。

- [ ] **Step 6: Task 7を検証してコミットする**

  Search、Archive、Settings、sidebarのテストとfrontend checksを実行する。

  Commit: `feat: add task search and organization`

### Task 8: 全体検証とUI回帰確認

**Files:**
- Modify: 回帰が見つかった関連テストのみ
- Test: frontend全体、Rust、手動UI確認

- [ ] **Step 1: Frontend全テストを実行する**

  Run: `/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run`

- [ ] **Step 2: TypeScript、Biome、ESLint、Vite build、diff checkを実行する**

- [ ] **Step 3: Rust format / testを実行する**

  Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 4: 手動受け入れ確認を行う**

  広い画面・狭い画面で、Task作成、Task header、Activity展開、承認待ち、Stop/Resume、再接続、Review、Terminal/Files unsupported表示、Search、Archive、Runtime設定、Model/Provider非表示を確認する。

- [ ] **Step 5: Task 8を検証してコミットする**

  Commit: `test: verify task workspace integration`

## Dependency order

1. Task 5: Task header、状態selector、Activity timeline
2. Task 6: Task context panel、Review、Terminal、Files
3. Task 7: Search、分類、Archive、Settings導線
4. Task 8: 全体検証

Task 6はTask 5のheader callbackと表示モデルに依存する。Task 7はTask 5のstatus selectorとTaskListItemに依存する。Task 8はすべての前段Taskが完了してから行う。
