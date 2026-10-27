# Ruxex GUI基盤 1〜4 設計・実装ドキュメント

調査・合意日: 2026-10-27<br>
対象: Ruxex Tauriデスクトップアプリ<br>
範囲: Task表示、New task、サイドバー、Project画面

この文書は、先行して作成したGUI仕様書・実装計画のうち、1〜4を簡略化して確定したものです。1〜4については、この文書を優先します。

## 共通方針

- Ruxexはプロバイダーフリーなコーディングエージェントである。
- Projectは作業コンテキスト、Taskは実際の開発作業として扱う。
- Model選択は残すが、特定Providerの名前や仕様をUIの前提にしない。
- Model / ProviderはTask一覧、Project名、Task headerの主表示には出さない。
- Daemon / InProcessは製品モードではなく、SettingsのRuntime設定である。
- Project画面はダッシュボード化せず、ProjectとTaskを素早く切り替えるための画面にする。
- Checks、テスト結果集約、CI/CD連携、Skills / SchedulesのProject内統合は今回の範囲外とする。

## 1. Task表示モデルと一覧行

### 目的

最近のTask、Project内Task、履歴画面で、同じ情報密度・同じ表示規約を使う。

### 表示仕様

```text
● Build the sidebar
  Running · Updated 2 minutes ago
```

表示する情報:

- Task名
- Task状態
- 最終更新時刻
- 現在のProject内で必要な場合だけWorktreeまたはブランチ

表示しない情報:

- Model名
- Provider名
- 内部ID
- Daemon / InProcess

### 状態

初期実装では、既存のApp Serverイベントから確実に判断できる状態だけを表示する。

- `running`: active turnがある
- `waiting`: 承認またはユーザー入力を待っている
- `completed`: turnが正常完了した
- `failed`: turnが失敗した
- `stopped`: ユーザーまたはシステムによって中断された

`queued`、`review`、`reconnecting`は、対応する確実なデータソースが追加された時点で拡張する。初期実装で推測による誤表示はしない。

### 実装

- `src/components/tasks/task-status.ts`
  - `TaskStatus`型
  - 状態ラベルと表示スタイル
- `src/components/tasks/TaskListItem.tsx`
  - Task行の共通コンポーネント
- `src/components/sidebar/ThreadList.tsx`
  - サイドバー内のTask行に共通コンポーネントを利用
- `src/components/common/ThreadCard.tsx`
  - Project画面・履歴画面のカード表示を共通化

### テスト

- Task名が空の場合のfallback
- 長いTask名のtruncate
- 各状態のラベル
- Model / Providerがレスポンスにあっても表示しない
- Project内TaskとRecent taskで同じ表示になる

## 2. New task

### 目的

現在のComposerを、単なるチャット開始ではなく、Projectと実行設定を指定してコーディングTaskを開始する画面として整理する。

### 表示仕様

```text
New task

Project       [Current project       ▼]
Model         [Default model        ▼]
Reasoning     [Default reasoning    ▼]
Permissions   [Ask before changes   ▼]

What should the agent work on?
┌────────────────────────────────────┐
│ Implement the requested change...   │
└────────────────────────────────────┘

[Start task]
```

### Project

- Projectページから開いた場合はProjectを選択済みにする。
- Homeから開いた場合はProjectを選択できる。
- ProjectなしでもTaskを開始できる。
- Projectを選択した場合は、既存のProject rootを`cwd`として利用する。

### Model / Reasoning / Permissions

Model選択は残す。Provider-freeとはModel選択を削除することではなく、Model一覧をApp Serverから取得し、特定Providerの固定UIにしないことを意味する。

- Model: `useModelList()`から取得
- Reasoning: 既存のReasoning設定を利用
- Permissions: workspace、read-only、full-accessの既存概念を利用
- ModelやReasoningの未選択を許可し、Defaultを利用できるようにする

### Worktree

New task画面ではWorktreeの詳細管理を行わない。ProjectまたはTaskの詳細から作成・選択・オープンできるようにする。

### 既存コードとの対応

- 対象: `src/components/chat/NewChatComposer.tsx`
- 変更方針: 必要なら表示名をNew taskへ寄せるが、作成・送信処理は既存の`useCreateThread`と`useSendMessage`を再利用する
- ルートは維持する:
  - `/chat/new`
  - `/projects/:projectId/chat/new`

### テスト

- Projectなしで開始できる
- Projectを選ぶと`projectId`とProject rootが渡る
- Modelを選択するとThread作成に渡る
- Model未選択でDefaultを使える
- ReasoningとPermissionsがThread作成に渡る
- 作成失敗時にTask画面へ遷移しない
- 送信成功後にTask画面へ遷移する

## 3. Task中心のサイドバー

### 目的

アイコンレールを中心に画面を切り替えるのではなく、TaskとProjectを直接選択できる、シンプルなサイドバーにする。

### 初期表示

```text
New task
Recent tasks

Projects
  Project A
  Project B

Settings
```

### 初期実装から外すもの

- Pinned専用セクション
- Active tasks専用セクション
- Schedules / Skillsの主ナビゲーション化
- 複雑なフライアウト
- Taskの高度な分類・ソート

Active / waiting / failedなどの状態はRecent tasks内のTask行に表示する。Pinnedや高度な検索は、基本導線が固まった後に別Taskとして検討する。

### レイアウト

- 広い画面では左側にサイドバーを常設する。
- アイコンレールは折りたたみ時の補助表示として残してよい。
- 展開時はTask一覧を直接見せる。
- Settingsはサイドバーの下部に置く。
- 既存のProjects、Schedules、Plugins、Account、Settingsへのルートは壊さない。

### 狭い画面

- サイドバーをメイン画面に重なるフローティング表示にする。
- TaskまたはProjectを選択したら閉じる。
- Close、Escape、パネル外クリックで閉じる。
- ComposerとTask本文を優先し、サイドバーが常に画面を占有しないようにする。

### 実装

- `src/components/tasks/TaskSidebarSections.tsx`
  - New task、Recent tasks、Projects、Settingsの表示
- `src/components/layout/AppLayout.tsx`
  - 開閉状態と選択中Taskの保持
- `src/components/sidebar/ProjectSidebar.tsx`
  - レイアウトと折りたたみ
- `src/components/sidebar/HomeSidebar.tsx`
  - 既存のProjects / Recent chatsをTask表示へ移行
- `src/styles/index.css`
  - 狭い画面でのフローティング表示

### テスト

- セクション順が正しい
- Recent taskの選択状態が表示される
- Project選択が既存ルートへ遷移する
- Settingsが下部にある
- 狭い画面でTask選択後に閉じる
- Escapeで閉じる
- 既存のProject、Settings、Schedules、Pluginsへの遷移が壊れない

## 4. Project画面

### 目的

Projectを開発管理ダッシュボードではなく、作業コンテキストとTask一覧を確認するシンプルな画面にする。

### 表示仕様

```text
Project Alpha
/workspace/project

[New task] [Project menu]

Tasks
  ● Implement authentication       Running
  ✓ Refactor sidebar               Completed
  ! Fix build error                Failed
```

### 表示するもの

- Project名
- Workspace root
- New task
- Project内のTask一覧
- Project menu

Project menuの候補:

- Rename
- Manage roots
- Open folder
- ArchiveまたはDelete
- Settings

### 表示しないもの

- Checks
- Test / Lint / Build結果の集約
- Skills / Schedules
- 大きなWorktree管理カード
- Provider / Model
- Active tasksとRecent tasksの別ダッシュボード

Worktree、Terminal、Diff、Review、テスト結果はProjectではなくTask画面に属する。Projectではworkspace rootを簡潔に示し、詳細操作はProject menuまたはTask画面へ委譲する。

### 既存コードとの対応

- `src/pages/ProjectsPage.tsx`
  - Project一覧と作成を維持
- `src/pages/ProjectHomePage.tsx`
  - Project headerとTask一覧を中心に簡略化
- `src/components/common/ThreadCard.tsx`
  - Task行の共通表示を利用
- `src/components/projects/WorktreeCard.tsx`
  - Project画面の主表示から外し、必要ならProject menuまたはTask contextから開く

### テスト

- Project名とworkspace rootが表示される
- Project内Taskが一覧表示される
- TaskをクリックするとTask画面へ遷移する
- New taskでProject contextが引き継がれる
- Project rootが未設定でも画面が壊れない
- Task一覧にModel / Providerが表示されない
- Checksや存在しない検証結果を表示しない

## 実装順序

依存関係を考慮し、次の順で実装する。

1. Task表示モデルと一覧行
2. New taskのProject / Model / Reasoning / Permissions整理
3. Task中心サイドバー
4. シンプルなProject画面

1の共通Task行を2〜4で再利用する。2のProject選択を3のNew task導線から利用し、4のProject画面からも同じNew taskを開く。

## 1〜4の完了条件

- Task一覧、Project内Task、履歴画面で表示規約が統一されている。
- 一覧やProject headerにModel / Providerを表示しない。
- New taskでProject、Model、Reasoning、Permissionsを選択できる。
- Model未選択時はDefaultで開始できる。
- Project選択時にProject rootがTaskへ引き継がれる。
- サイドバーはNew task、Recent tasks、Projects、Settingsに絞られている。
- Project画面はProject情報とTask一覧だけを中心に表示する。
- Checksなど未実装の機能を表示しない。
- 狭い画面でサイドバーがTask操作を妨げない。
