# RuxexコーディングエージェントGUI設計

> 1〜4の確定スコープは [Ruxex GUI基盤 1〜4 設計・実装ドキュメント](./ruxex-gui-foundation-1-4.md) を優先する。この文書のProject dashboard、Checks、Pinnedなどの記述は将来候補または参考案であり、初期実装の要件ではない。

調査日: 2026-10-27<br>
対象: Ruxex Tauriデスクトップアプリ<br>
前提: プロバイダーフリー、コーディングエージェント専用、ChatGPT / Workの統合は行わない

## 1. 設計方針

Ruxexは特定のモデル、ベンダー、クラウドサービスを中心にしたチャットアプリではない。中心に置くのは「コード作業を依頼し、エージェントの実行を追跡し、変更をレビューして、次の作業へつなげる」ためのワークスペースである。

したがって、参考にするGUIはChatGPT全体ではなく、Codex系デスクトップアプリに見られる次の汎用パターンに限定する。

- 複数のコーディングタスクを管理する司令塔
- プロジェクトごとのリポジトリ・ワークツリー・タスクの整理
- タスクごとの会話と実行履歴
- エージェントの進捗、判断、待機、承認要求の可視化
- 独立したワークツリーとレビュー可能な差分
- ターミナル、テスト結果、ファイル変更、レビューを同じタスクから開く導線
- 再利用可能なスキルと自動化

アプリの主語は常にRuxexであり、UI上にOpenAI、ChatGPT、Codexなどのプロダクト固有名称を持ち込まない。

## 2. 採用する概念モデル

| 概念 | Ruxexでの意味 | GUI上の主な表示 |
| --- | --- | --- |
| Project | リポジトリ、ルート、設定、ワークツリー、タスクをまとめる単位 | Project一覧、プロジェクトヘッダー |
| Thread / Task | 一つの依頼と、その会話・実行・判断・成果物の単位 | Recent tasks、タスク画面 |
| Run / Turn | エージェントが作業した一回の実行単位 | 進捗、ログ、状態、停止ボタン |
| Agent | タスクを実行する主体。実装上のバックエンドは抽象化する | Agent activity、担当・状態 |
| Worktree | タスク専用の作業ディレクトリまたはブランチ | Worktree、branch、変更状態 |
| Artifact | 差分、テスト結果、レビュー、生成ファイルなどの成果物 | Review、Files、Checks |
| Approval | 実行・変更・外部作用の前に必要な確認 | Approval card、Approve / Reject |
| Provider / Model | 任意のバックエンド設定。主画面には露出させない | Settingsの接続・実行設定 |

Provider / ModelはRuxexの内部拡張点として残してよいが、会話一覧・プロジェクト一覧・タスクヘッダーの主表示には出さない。特定プロバイダー名を前提にした設定画面やアイコンも避ける。

## 3. 参考にするCodex系GUIの汎用要素

公式のCodex関連情報から、Ruxexへ取り込む対象を次のように整理する。

| 参照パターン | Ruxexへの置き換え |
| --- | --- |
| 複数のコーディングエージェントを並行管理する司令塔 | Project内のActive tasksとRecent tasks |
| 独立したworktreeでタスクを実行 | Worktree単位でタスクを隔離し、変更を比較可能にする |
| reviewable diff | タスク画面からDiff / Files / Checksへ移動する |
| agent progress and decisions | Activity timelineに進捗、判断、待機理由を表示する |
| local folders / repositories / terminals | Projectのworkspace root、Terminal、File contextとして表現する |
| skills / automations | Skills、Schedules、Task templatesとして抽象化する |
| approvals | 実行前確認と外部作用確認をタスク内カードで扱う |

これらは特定のアカウント、モデル、クラウド同期、チャット製品の機能ではなく、コーディングエージェントの操作モデルとして採用する。

## 4. アプリ全体の情報設計

```text
┌──────────────────────────────────────────────────────────────────┐
│ Ruxex       [Project selector]                 [New task] [status]│
├────────────────┬─────────────────────────────────────────────────┤
│ Search tasks   │                                                 │
│ New task       │                 Task workspace                  │
│                │                                                 │
│ Pinned         │  Task header                                    │
│ Active tasks   │  conversation / activity / approvals             │
│ Recent tasks   │                                                 │
│                │  composer                                       │
│ Projects       │                                                 │
│  Project A     ├──────────────────────┬──────────────────────────┤
│  Project B     │ optional context      │ optional review           │
│                │ terminal / files      │ diff / checks              │
│ Schedules      │                      │                            │
│ Skills         │                      │                            │
│                │                      │                            │
│ Settings       │                      │                            │
└────────────────┴──────────────────────┴──────────────────────────┘
```

### 4.1 上部バー

上部バーはプロダクト切替ではなく、現在の作業コンテキストを示す。

- 左: Ruxexの名前またはロゴ
- 中央または左寄り: Project selector
- 右: New task、実行状態、通知、アカウントまたは設定への短い導線
- 現在のProjectやThreadがない場合も、New taskを常に到達可能にする
- モデル名、プロバイダー名、APIサービス名は上部バーに置かない

### 4.2 左サイドバー

左サイドバーは「場所を選ぶ」ための領域であり、個別の実行詳細を詰め込まない。

1. Search tasks
2. New task
3. Pinned
4. Active tasks
5. Recent tasks
6. Projects
7. Schedules / Skills（機能が有効な場合のみ）
8. Settings（下部固定）

個別タスクの行には、タイトル、状態、最終更新、必要ならProject名またはworktree名だけを表示する。モデル名、プロバイダー名、内部ID、Daemon / InProcessのような実行方式は通常行から外す。

## 5. 画面仕様

### 5.1 New task

New taskはチャット開始画面ではなく、実装作業の開始ウィザードとする。

入力項目:

- Task titleまたは依頼文
- Project
- Workspace rootまたはRepository
- Worktreeの作成・既存利用
- 実行に必要な権限や確認ポリシー
- 任意の添付ファイル、対象ファイル、関連タスク

UI上の既定操作は「依頼文を入力して開始」でよい。詳細なProvider / Model / Runtimeの選択はAdvanced settingsへ退避し、通常の作業開始を妨げない。

### 5.2 Project overview

Projectは単なるフォルダ一覧ではなく、継続的な開発作業のホーム画面とする。

```text
Project header
  ├─ Project name
  ├─ workspace roots
  ├─ New task
  └─ Project actions

Project body
  ├─ Active tasks
  ├─ Recent tasks
  ├─ Worktrees
  ├─ Checks / recent test results
  ├─ Skills / schedules
  └─ Project settings
```

Project actionsにはRename、Manage roots、Open folder、Archive、Settingsを置く。ProviderやモデルをProjectのタイトル領域に表示しない。

### 5.3 Task / Thread workspace

Task画面は会話と実行状況を一体化する。

```text
Task header
  ├─ task title
  ├─ status badge
  ├─ project / worktree
  ├─ Run / Stop / Resume
  └─ Review / Open terminal

Main stream
  ├─ user request
  ├─ agent response
  ├─ activity: command, file read/write, test, decision
  ├─ approval request
  ├─ artifact or review result
  └─ follow-up message

Composer
  ├─ message input
  ├─ attach file / select context
  ├─ execution action
  └─ send / stop
```

Task headerの状態は次のように明確にする。

- `queued`: 実行待ち
- `running`: エージェント実行中
- `waiting`: ユーザー承認または入力待ち
- `review`: 差分・テスト結果の確認待ち
- `completed`: 作業完了
- `failed`: 実行失敗
- `cancelled`: ユーザーが停止

会話本文だけで実行状態を表現せず、Activity itemとStatus badgeを併用する。これにより、長いログの途中でも現在の状態が分かる。

### 5.4 Activity timeline

Activityはエージェントの内部思考を表示するものではなく、ユーザーが作業を判断するための操作可能なイベントとする。

表示対象の例:

- ファイルを読み取った
- ファイルを変更した
- コマンドを実行した
- テストを開始・完了した
- 判断理由の要約を記録した
- 承認を要求している
- 差分を生成した
- 実行が停止・失敗・再接続した

各Activityは折りたたみ可能にし、詳細ログ・対象ファイル・コマンド・結果を開けるようにする。通常表示では要約と状態だけを見せる。

### 5.5 Review workspace

Reviewはタスク完了後の別ページではなく、Task workspaceからいつでも開ける隣接ビューとする。

```text
Review
  ├─ changed files tree
  ├─ unified / split diff
  ├─ inline comments or findings
  ├─ test / lint / build checks
  ├─ worktree and branch information
  └─ next action: continue, apply, commit, open terminal
```

レビュー画面では、差分の内容、チェック結果、対象worktreeを優先し、モデル名やプロバイダー名を表示しない。コミット・プッシュは実行可能な操作だが、UI上では結果確認と承認を明確に分ける。

### 5.6 Worktree / terminal / files

- ProjectからWorktree一覧を開ける。
- Taskから現在のworktreeを開ける。
- Terminalはタスクの実行ログと混ぜず、独立したタブまたは右側パネルで開く。
- File contextは「添付ファイル」ではなく、Project rootと対象ファイルの参照として扱えるようにする。
- Worktreeが削除・再作成・切り替えされた場合は、Task headerに状態を表示する。

## 6. Settings設計

Settingsはサイドバー下部から開く。主画面のタスク操作と混ざらないよう、設定画面はカテゴリごとの縦ナビゲーションにする。

推奨カテゴリ:

- General
- Appearance
- Runtime
  - App Server mode: Daemon / InProcess
  - startup behavior
  - reconnect behavior
- Connections
  - provider adapters
  - endpoint / credentials state
- Models / Engines
  - 利用可能な抽象エンジン
  - default selection
- Permissions
  - file access
  - command execution
  - approval policy
- Skills
- Schedules
- About

Provider-freeの原則は、Provider設定を削除することではなく、特定プロバイダーを必須の主役にしないことである。ProviderやModelはアダプターの設定として保持し、Home、Project、Task、Reviewの主操作はどのバックエンドでも同じにする。

## 7. レスポンシブ挙動

### 広い画面

- 左サイドバーを常設する。
- Taskのメインストリームを中央に置く。
- Review、Terminal、Filesなどは右側パネルまたはタブとして開く。
- Project selectorとNew taskを常に上部から操作できる。

### 狭い画面

- サイドバーはフローティングパネルとしてメイン領域に重ねる。
- タスクを選択したら自動的に閉じる。
- ReviewやTerminalは全画面または下部シートに切り替える。
- Composerは画面下端に残し、入力領域を優先する。
- パネル外クリック、Escape、Closeボタンで閉じる。

### アクセシビリティ

- すべての状態を色だけで表現しない。
- Status badgeにはテキストを含める。
- Activity、Review、Terminal、Filesはキーボードで切り替えられるようにする。
- サイドバーの開閉、New task、Searchには明示的なラベルとショートカットを持たせる。
- 長いログと差分は仮想スクロールまたは折りたたみで操作可能な量に抑える。

## 8. Ruxex現状との対応

| 対象 | 現在の実装 | 設計上の変更 |
| --- | --- | --- |
| App shell | `AppLayout`にBrowserNavigationBar、ProjectSidebar、mainがある | 上部をProject selector / New task中心に整理 |
| サイドバー | `ProjectSidebar`のアイコンレール + コンテキストパネル | タスク中心の単一サイドバーへ寄せる |
| Recent chats | `HomeSidebar`内の`ThreadList` | `Recent tasks`へ改名し、状態・Project・worktreeを扱う |
| Projects | `ProjectsPage`と`ProjectHomePage`がある | Active tasks、Worktrees、Checks、Skillsを追加 |
| Chat画面 | `ConversationWorkspace` | Task workspaceへ改名・拡張し、Activity / Review / Terminalを統合 |
| Composer | `Composer`に入力、添付、Plan、送信モードがある | コーディングタスク用のcontext、run、approval操作を整理 |
| 実行状態 | App ServerイベントとThread状態がある | Task headerとActivityへ一貫して表示 |
| Review | Review controlsと差分関連機能がある | Taskから差分・チェックへ直接遷移できるようにする |
| Worktree | Project / Worktree関連画面がある | Taskとの1対1または明示的な関連を表示 |
| Settings | Account、Appearance、Models、App Server等がある | Runtime / Connections / Permissionsを中心に整理 |
| モデル表示 | チャット一覧から削除済み | 一覧・ヘッダーには表示しない。設定内だけで扱う |

## 9. 実装優先順位

### P0: コーディングエージェントの骨格

1. `HomeSidebar`を`Recent tasks`中心に再構成する。
2. タスク行へstatus、last updated、project / worktreeを追加する。
3. `ConversationWorkspace`をTask workspaceとして整理する。
4. Task headerにRun、Stop、Resume、Review、Open terminalを追加する。
5. Activity itemで実行、変更、テスト、承認待ちを表示する。
6. Project overviewにActive tasks、Worktrees、Checksを追加する。

### P1: 司令塔としての操作性

1. Search tasksを追加する。
2. Pinned、Active、Recent、Archivedを分ける。
3. タスクのRename、Pin、Archive、Delete、Move projectを追加する。
4. Review workspaceをTaskから直接開けるようにする。
5. Terminal / Files / Diffを同一Taskのコンテキストとして扱う。
6. SkillsとSchedulesをサイドバーの補助機能として追加する。

### P2: 仕上げと安全性

1. 狭い画面のフローティングサイドバーを実装する。
2. 承認要求を共通カード化する。
3. コマンド・ファイル変更・外部作用ごとの権限表示を統一する。
4. キーボードショートカット、フォーカス管理、状態ラベルを整える。
5. Provider / Model / RuntimeをAdvanced settingsへ整理する。

## 10. 非目標

- ChatGPT、Chat、Workの切替を作ること
- OpenAI固有のブランド、モデル名、クラウド同期、Voice、Apps、Library、Canvas、Sitesを作ること
- 特定プロバイダーのアイコンや接続方式を主UIに埋め込むこと
- 一覧行へモデル名やプロバイダー名を表示すること
- チャットアプリとしての汎用的な会話履歴を主目的にすること
- Daemon / InProcessをプロダクトモードとして扱うこと

## 11. 受け入れ条件

- 起動後、ユーザーはProjectを選択するかNew taskから作業を開始できる。
- タスク一覧はコード作業の再開に必要な情報だけを表示し、モデル名・プロバイダー名を表示しない。
- タスクごとにProject、worktree、状態、最終更新を確認できる。
- 実行中の進捗、判断、コマンド、変更、テスト、承認待ちをActivityとして確認できる。
- Task画面から停止、再開、Review、Terminal、Filesへ移動できる。
- Project画面からActive tasks、Recent tasks、Worktrees、Checksを確認できる。
- Review画面で変更ファイル、差分、テスト結果、次の操作を確認できる。
- Provider / Model / Runtimeの設定は主画面から分離され、抽象的な設定として扱われる。
- 狭い画面ではサイドバーとReview / Terminalがメイン作業を妨げない。
- ChatGPT固有の機能・用語・導線がUI仕様に混入していない。

## 12. 参照資料

Codex系GUIの汎用要素を確認するため、OpenAIの公式資料を参照した。資料中のChatGPT固有部分はRuxexの仕様から除外している。

- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex) — Codexのローカルフォルダ、リポジトリ、ターミナル、開発ツール、タスク単位の操作
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) — Codex Local、Agent view、複数エージェント、Worktrees、スキル、ローカル実行の整理
- [ChatGPT Business release notes](https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes) — Codex appを複数エージェント、isolated worktrees、reviewable diffs、agent progress and decisionsを扱う司令塔として説明している箇所
- [Review pull requests with Codex](https://help.openai.com/en/articles/20001552-review-pull-requests-with-codex) — 変更ファイル、関連行、レビューを中心にした差分確認の導線

この仕様書はRuxexの現在のコンポーネント構造を前提にした設計方針であり、実装時には既存のApp Server API、スレッド状態、Worktree機能、権限モデルに合わせて画面単位へ分割する。
