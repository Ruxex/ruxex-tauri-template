# Thread Summary、Visualize、Activity Center 設計

## Intent

チャット画面にCodex互換の作業状況を表示し、親スレッドの会話を維持したまま、サブエージェント・可視化・承認待ちを確認できるようにする。

第一段階では既存AppServerのプロトコルとイベントを利用し、AppServerの変更を行わない。実装対象をUIとTauriのHTML読み込み・サンドボックスに限定し、未対応のCodex機能は明示的にTBD表示する。

## Goals

- チャット右上からThread Summary Panelを開ける。
- Thread Summary PanelにCodex準拠の5セクションを表示する。
- 5セクションのうちSubagentsだけを機能実装し、他4つはTBD表示にする。
- Subagentsで起動済みAgentのActive / Done状態、担当、結果、子スレッドを確認できる。
- Codex Visualizeスキルと互換性のあるHTMLファイル＋`visualize`参照を描画する。
- OpenAI固有の`window.openai` APIとOpenAIホストのチャートランタイムに依存しない。
- 既存Approval Centerを再利用してActivity Centerを構成する。
- Activityから元スレッド、子Agent、承認リクエストへ遷移できる。

## Non-goals

- 第一段階でSources / Web Searchを解析・表示すること。
- 第一段階でChanges、Branch details、Git actionsを実装すること。
- サブエージェントのspawn前に専用の承認プロトコルを追加すること。
- OpenAIの`persistent.oaistatic.com`にある可視化コンポーネントを利用すること。
- 可視化内からモデルへフォローアップを送るホストAPIを実装すること。
- AppServerに新しいThreadItemまたはActivity APIを追加すること。

## Current state and constraints

### AppServer and protocol

Ruxexの生成済みv2プロトコルには、サブエージェントのための既存情報がある。

- `Thread.parentThreadId`
- `Thread.agentNickname`
- `Thread.agentRole`
- `thread/list`の`parentThreadId` / `ancestorThreadId`
- `collabAgentToolCall`
- `subAgentActivity`

`collabAgentToolCall`のツール名には`spawnAgent`、`sendInput`、`resumeAgent`、`wait`、`closeAgent`、`sendMessage`、`followupTask`、`interruptAgent`、`listAgents`が含まれる。

既存UIは`collabAgentToolCall`を汎用Activityとして表示するが、`subAgentActivity`専用の表示はない。子スレッドの取得・表示には既存の`thread/list`、`thread/read`、`thread/items/list`、`turn/start`、`turn/interrupt`を使う。

### Current approval and activity state

`ApprovalCenter`は`useServerRequests()`から保留中のサーバーリクエストを取得し、`ServerRequestCard`で承認・拒否を処理している。AppServerイベントストアは保留中リクエスト、履歴、スレッドごとのライブ状態を保持している。

したがって、Activity Centerの第一段階は既存状態の投影として実装できる。永続的な全履歴が必要な場合は、`thread/list`と`thread/items/list`による再構築を利用し、専用のAppServer履歴APIは追加しない。

### Visualize skill compatibility

CodexのVisualizeスキルは、HTMLフラグメントをファイルに保存し、次のようなホスト参照を出力する方式を採用している。

```text
visualize{"path":"/path/to/visualization.html","mode":"wide"}
```

スキルのHTMLはsandbox iframe内で実行されることを前提とし、外部通信、任意の親ウィンドウ操作、過大なデータ、アクセシビリティ不足を避ける。`window.openai.widgetState`、`window.openai.setWidgetState`、`window.openai.sendFollowUpMessage`はCodexホスト固有のAPIであるため、Ruxex版では使わない。

`persistent.oaistatic.com`上のチャート・ウィジェットランタイムもOpenAI依存となるため、第一段階では使わず、自己完結HTMLまたはRuxexが管理するライブラリを使う。

## Approaches

### A. 汎用Markdownブロック方式

`html-render`などのコードフェンス内にHTMLを直接返し、Markdown描画中にiframeへ変換する。

- 長所: AppServer変更なし、実装が単純、ストリーミングと相性がよい。
- 短所: CodexのVisualize方式と異なる。大きなHTMLが会話本文に保存され、再利用・サイズ管理が難しい。
- 判断: Codex互換という今回の目的に合わないため不採用。

### B. Codex互換のファイル＋参照方式

スキルがHTMLファイルを作成し、Agentメッセージ内に`visualize{...}`参照を返す。Ruxex UIが参照を検出し、Tauri経由でファイルを読み込み、sandbox iframeで表示する。

- 長所: Codexの出力契約に近い。大きな可視化、再描画、履歴表示に適する。AppServer変更が不要。
- 短所: Tauri側の安全なファイル読み込みとHTMLラッパーが必要。ストリーミング中はファイルが未完成になるため、完了後に表示する必要がある。
- 判断: 採用。今回のVisualize実装方式とする。

### C. 専用Visualize ThreadItem方式

AppServerに`visualization`専用Itemとストリーミング・状態保存・更新イベントを追加する。

- 長所: 型安全で、履歴・差分・状態を正式に扱える。
- 短所: AppServer、生成コード、クライアント、永続化の変更が必要。今回の「AppServer無変更」の制約に反する。
- 判断: 将来拡張として保留。

## UX design

### Thread Summary Panel

チャットヘッダー右上にSummaryボタンを置く。クリックすると親チャットを残したまま右側にパネルを開く。

```text
┌─────────────────────────────────────────────┐
│ Thread title                  [Summary]      │
├───────────────────────────────────┬─────────┤
│                                   │ Summary │
│             Parent chat           │         │
│                                   │Subagents│
│                                   │Sources  │
│                                   │Changes  │
│                                   │Branch  │
│                                   │Git     │
└───────────────────────────────────┴─────────┘
```

セクションは次の順序・表示名で固定する。

1. `Subagents`
2. `Sources / Web Search`
3. `Changes`
4. `Branch details`
5. `Git actions`

2〜5は初期状態で`TBD`バッジと短い説明を表示する。未実装項目を空欄にしない。

#### Subagents section

ActiveとDoneを分けて表示する。各Agent行には以下を表示する。

- `agentNickname`または`agentRole`
- 状態
- 担当タスクまたはspawn prompt
- 最終更新時刻・経過時間
- 完了サマリーまたは直近Activity
- 未読・承認待ちバッジ

行をクリックすると、パネル内を子スレッド詳細に切り替える。戻るボタンでAgent一覧に戻る。子スレッドの表示は既存の会話Itemレンダリングを再利用する。

Agentの実行状態は、スレッドの状態と`subAgentActivity` / `collabAgentToolCall`を統合して決める。ライブイベントがある間はイベントストアを優先し、再読み込み後は`thread/list(parentThreadId)`と保存済みItemから再構築する。

### Activity Center

`/approvals`の既存画面とコンポーネントを基礎に、独立ページとしてActivity Centerを追加する。

フィルターは第一段階で次を用意する。

- `All`
- `Needs action`
- `Running`
- `Agents`
- `Completed`

`Needs action`は既存の`ServerRequestCard`を使う。その他はAppServerイベントとスレッド情報からActivity行を作る。

Activity行の例:

- Agent started / completed / failed / interrupted
- command execution
- file change
- MCP tool call
- approval requested
- turn completed

行を選択すると、元スレッドを開く。AgentイベントはThread Summary Panelの該当Agent詳細へ遷移する。保留中の承認は既存の承認操作をその場で実行できる。

### Visualize display

AgentMessage内の次の参照を検出する。

```text
visualize{"path":"...","mode":"wide"}
```

検出後の処理:

1. JSONをパースする。
2. `path`が許可されたワークスペース内にあるか検証する。
3. TauriコマンドでHTMLを読み込む。
4. サイズ、拡張子、存在を検証する。
5. CSP付きsandbox iframeの`srcdoc`に表示する。
6. `mode`に応じて通常幅またはwide幅にする。

iframeには、第一段階ではRuxexホストAPIを注入しない。可視化内の状態はHTML内のJavaScriptだけで保持する。

HTMLが見つからない、参照が不正、サイズ超過、読み込み失敗の場合は、エラーカードを表示し、参照テキストを折りたたんだデバッグ情報として表示する。通常のMarkdown表示を壊さない。

## Implementation boundaries

### Web UI

想定する追加・変更箇所:

- Thread headerのSummaryトリガー
- `ThreadSummaryPanel`
- `SubagentsSection`
- `SubagentDetail`
- TBD表示用のSummaryセクション
- Activity CenterとActivity行
- `visualize`参照の抽出
- Visualize iframe表示
- Agent / Activity用のReact Queryとイベントストア投影

既存の`MarkdownContent`は通常のMarkdown処理を維持し、Visualize参照だけを専用Itemまたは専用ブロックとして上位のConversation modelで抽出する。HTMLをMarkdown rendererに直接渡さない。

### Tauri

追加する読み込みAPIは、任意の絶対パスを開かない。対象スレッドまたはプロジェクトの許可されたワークスペース配下に限定し、パス正規化後にルート外を拒否する。

Tauriから返すのはHTMLの内容だけとし、iframeはWeb UI側で生成する。HTMLにTauri IPCやアプリオリジンへのアクセス権を与えない。

### AppServer

第一段階では変更しない。

既存の以下を利用する。

- `thread/list`
- `thread/read`
- `thread/items/list`
- `turn/start`
- `turn/interrupt`
- `turn/steer`
- AppServer通知
- Skills読み込み機構

## Security requirements

- HTMLをReact DOMへ直接挿入しない。
- `iframe sandbox="allow-scripts"`を使う。
- `allow-same-origin`、`allow-top-navigation`、`allow-popups`は付けない。
- 初期版ではネットワーク通信を禁止するCSPを設定する。
- HTMLファイルのパスを許可ルート内に限定する。
- HTMLサイズを制限する。
- OpenAIの`window.openai`を実行環境に提供しない。
- `persistent.oaistatic.com`のランタイムを依存先にしない。

## Verification

### Thread Summary

- Summaryボタンでパネルが開閉する。
- 5セクションが表示される。
- Subagentsだけが実データを表示する。
- Sources / Web Search、Changes、Branch details、Git actionsはTBD表示になる。
- Active / Doneが正しく分かれる。
- 子Agentをクリックして詳細を開ける。
- Agent完了後にDoneへ移動する。
- 親チャットのスクロール位置と入力状態が壊れない。

### Activity Center

- 保留中の承認がNeeds actionに表示される。
- 既存の承認・拒否操作が動作する。
- Agentイベントから元スレッド・Agent詳細へ遷移できる。
- 切断中に適切な状態表示がある。
- 空状態が表示される。

### Visualize

- 正常な`visualize`参照がHTMLとして表示される。
- `mode: wide`が反映される。
- `window.openai`なしで動作する。
- `fetch`などのネットワーク通信がブロックされる。
- ワークスペース外のパスが拒否される。
- 不正JSON、存在しないファイル、サイズ超過が安全にエラー表示される。
- 通常のMarkdown、コードブロック、画像表示に回帰がない。

## Future extensions

- Sources / Web Searchの実装
- ChangesのGit差分表示
- Branch detailsのGit情報表示
- Git actionsの履歴と操作
- VisualizeのRuxexホストブリッジ
- 可視化状態のスレッド単位保存
- 専用`visualization` ThreadItem
- Agent spawn前の専用承認リクエスト
