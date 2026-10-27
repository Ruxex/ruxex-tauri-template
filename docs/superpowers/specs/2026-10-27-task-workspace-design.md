# Task Workspace Design

## Intent

Ruxexの現在の`/chat/:threadId`画面を、コーディングAgentの作業単位であるTask Workspaceへ段階的に拡張する。URLと既存の会話処理は維持し、チャット本文を中心に、実行状態・Activity・承認・Review・Terminalへの導線を同じ画面で扱えるようにする。

Taskは「会話」ではなく、Projectとworkspaceを背景に持つ一回の開発作業として表示する。ただし、既存のThread/App Server APIをTaskの実体として再利用する。

## Goals

- 現在のチャット画面をTask画面として自然に理解できる表示へ変更する。
- Task名、状態、Project、workspace、接続状態をヘッダーで確認できるようにする。
- メッセージとAgentのActivityを同じ時系列で確認できるようにする。
- 実行中、承認待ち、完了、失敗、中断、再接続中を誤表示しない。
- 既存の送信、停止、承認、Review開始、イベント再同期処理を再利用する。
- Provider名・Model名・ChatGPT固有機能をTaskの主表示に持ち込まない。

## Non-goals

- `/chat/:threadId`とは別のTask専用ルートを追加しない。
- ChatGPT、OpenAI、Work、Voice、Apps、Library、Canvas、Sitesなどの固有機能を追加しない。
- Project画面にChecksやCI/CDの集約ダッシュボードを追加しない。
- Task画面で自動Commit、Push、外部公開を実行しない。
- Activityから推測できない状態を表示しない。
- Worktree、Review、Terminalの完全な管理機能を一度に実装しない。

## Chosen approach

### Existing ConversationWorkspaceの段階的拡張

`ThreadPage`と`/chat/:threadId`を維持し、`ConversationWorkspace`をTask Workspaceのシェルにする。既存の`useThreadConversation()`、`useAppServerEvents()`、`Composer`、`ActivityItem`、`ReviewControls`を境界として再利用し、次の順で責務を分割する。

1. Task headerを追加する。
2. 現在の会話・Activity表示をTask activity timelineとして整理する。
3. 承認要求・再接続・停止状態をヘッダーとTimelineへ接続する。
4. Review、Terminal、FilesはTask context panelへ段階的に追加する。

別のTask routeや別の状態管理を作らないことで、既存のdeep link、サイドバー選択、App Serverイベント、Composerの送信処理を壊さずに移行できる。

## UI structure

```text
Task Workspace (/chat/:threadId)
├── TaskHeader
│   ├── Task name / fallback title
│   ├── Status badge
│   ├── Project / workspace root
│   ├── Reconnecting / pending approval indicator
│   └── Stop / Resume / Review / Terminal actions
├── TaskActivityTimeline
│   ├── User message
│   ├── Agent message
│   ├── Command / file change / plan / reasoning
│   ├── Approval request
│   └── Error / completion summary
├── Context panel (later phase)
│   ├── Review
│   ├── Terminal
│   └── Files
└── Composer
```

TaskHeaderは短く常時表示する。Activityは既存の`ConversationViewItem`と`LiveConversationItem`を利用し、メッセージは本文、実行情報は折りたたみ可能なSummaryとして表示する。

## State model

### Sources of truth

- 保存済みThread、Turn、Item: `useThreadConversation(threadId)`
- 実行中のTurnとActivity: `useAppServerEvents()`の`threads[threadId]`
- 承認・ユーザー入力などの要求: `pendingServerRequests`
- 再接続状態: `events.resynchronizing`および対象Threadの`resynchronizing`

`event-reducer.ts`をライブ状態の唯一のソースとし、コンポーネントごとに独自の実行状態を持たない。

### Display states

初期状態では、データから確実に判定できる状態だけを表示する。

| UI state | 判定 |
| --- | --- |
| Running | active turnまたはlive statusがrunning |
| Waiting | 対象Threadのpending server requestがある、またはactive flagが承認・入力待ち |
| Completed | live turnがcompleted |
| Failed | live turnまたは保存済みturnがfailed、またはsystemError |
| Stopped | live turnがinterrupted |
| Reconnecting | event storeまたは対象Threadがresynchronizing |

`queued`、`review`など、現在のデータから確実に分離できない状態は推測表示しない。Review実行中は、Review APIの明確な状態データが追加された時点で別状態として拡張する。

## Component responsibilities

### `TaskHeader`

- Thread名を表示し、名前がない場合はpreviewまたは`Untitled task`へフォールバックする。
- 共通Task status formatterを利用する。
- Project名、workspace root、Worktree情報を利用可能な場合だけ表示する。
- Stopは現在のactive turnに対する既存のinterrupt処理を呼び出す。
- Resumeは既存の`useResumeThread`を呼び出す。
- Review / TerminalはTask context panelの開閉または既存導線を呼び出す。
- Model、Provider、内部Thread IDは表示しない。

### `TaskActivityTimeline`

- 保存済みItemとlive Itemを`mergeConversationItems()`で統合する。
- User/Agent messageは会話本文として表示する。
- Command、file change、plan、reasoning、tool、approval、failureはActivityとして表示する。
- ActivityはSummaryを初期表示し、詳細を`details`で展開できるようにする。
- 実行中ActivityにはアクセシブルなRunning状態を付ける。
- 既存のImage、Markdown、browser open処理は再利用する。

### `ConversationWorkspace`

- データ取得とエラー・ローディング境界を保持する。
- TaskHeader、TaskActivityTimeline、Composerを配置する。
- 会話Itemのmerge処理を変更せず、表示責務だけを新コンポーネントへ分離する。

## Error and reconnect behavior

- Thread取得失敗時は現在のエラー表示を維持する。
- イベント切断中にactiveなTaskをCompletedへ変更しない。
- 再接続中はヘッダーに明示し、最後に確認できたActivityを保持する。
- pending requestがある場合はWaitingを表示し、要求解決後にライブ状態へ戻す。
- Stop、Resume、Reviewの失敗はTask画面内に表示し、不要な画面遷移を起こさない。

## Accessibility and responsive behavior

- Header actionsは固有の`aria-label`とdisabled状態を持つ。
- Activityの開閉はキーボードで操作できる`details/summary`または同等のbuttonで実装する。
- 狭い画面ではHeader actionsを折り返し、Activity本文とComposerの操作領域を優先する。
- Task context panelは狭い画面でoverlayとして開き、EscapeとCloseで閉じる。

## Testing strategy

- `TaskHeader`の状態表示、fallback、Stop/Resume/Review/Terminal actionを単体テストする。
- `TaskActivityTimeline`の保存済みItem/live Itemの統合、Activityの展開、実行中表示をテストする。
- `ConversationWorkspace`でloading/error/reconnecting/pending requestをテストする。
- `event-reducer`でcompleted、failed、interrupted、pending request、切断後のresynchronizingをテストする。
- 既存のComposer、ReviewControls、ConversationItem、ActivityItemの挙動を回帰テストする。
- Model/Provider名がTask headerやActivity summaryに出ないことをテストする。

## Acceptance criteria

- 既存の`/chat/:threadId`でTask名、状態、Project/workspaceを確認できる。
- 実行中、承認待ち、完了、失敗、中断、再接続中をデータに基づいて表示できる。
- Agent messageとActivityが時系列で確認でき、詳細を展開できる。
- Stop、Resume、Reviewの既存APIがTask画面から利用できる。
- App Server切断時にTaskを誤ってCompleted表示しない。
- Model / Provider / 内部IDが主表示に出ない。
- 既存のTask一覧、Project、New task、deep linkが壊れない。
- Frontend tests、TypeScript、Biome、ESLint、Vite buildが成功する。

## Open implementation choices

以下は実装方針として確定する。

- ライブイベントがない履歴Taskでは、`thread.turns`の最新Turnから`completed`、`failed`、`stopped`を復元する。判定不能な場合は状態を表示しない。
- 再接続中は独立した警告表示を優先するが、直前のRunning / Waiting状態は保持し、再接続をCompletedとして扱わない。
- Taskの実効workspaceは`thread.cwd`を正とする。Project rootはProject contextとして表示し、複数rootは代表rootと件数で示す。branchは`thread.gitInfo.branch`が存在する場合だけ表示する。
- pending approval / user inputは既存の`ServerRequestCard`をTask画面内に表示し、その場で回答できるようにする。Approval Centerは全Task横断の一覧として残す。
- Task 5のReview actionは既存の`review/start`を開始する。Review context panelへの切り替えはTask 6で追加する。
- Activity summaryの文言は既存のActivityItem presentationを優先し、新たなProvider固有のラベルを追加しない。
