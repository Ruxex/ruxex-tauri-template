# Ruxex プロダクト方向性メモ

作成日: 2026-11-04
状態: 構想メモ。実装仕様・ロードマップとしては未確定。

## 1. 今回の方向性

### 決定事項

- **クラウド対応はしない。**
  - エージェント、ブラウザ、ファイル、成果物、認証情報はローカル実行を基本にする。
  - 「PCを閉じてもクラウドで継続」「スマホからクラウドタスクを監視」はRuxexの目標に含めない。
  - Local／Remote App Serverは残せるが、OpenAIやAnthropicのような製品管理型Cloud実行環境とは分けて考える。
- **グローバルパネルはClaude Quick Entry型で実装する。**
  - グローバルショートカットで、どのアプリからでも小型パネルを開く。
  - パネルから短い依頼、範囲選択スクリーンショット、現在のアプリウィンドウ添付、音声入力を行う。
  - 送信先は新規Threadまたは現在のProject／Threadから選ぶ。
  - パネルはRuxex本体の常駐・バックグラウンド機能として動かし、OSごとのショートカットは設定で変更可能にする。
  - macOSの初期ショートカットはClaudeのQuick Entryを参考にOption二度押しとするが、他OSでは衝突しにくい既定値を別途定める。

### 有力な方向性

- **グローバルショートカットから小さなRuxexパネルを開く。**
  - どのアプリからでも呼び出せる。
  - 短い依頼を入力できる。
  - 範囲選択スクリーンショットや現在のアプリウィンドウを添付できる。
  - 音声入力で依頼できる。
  - 送信先は新規Threadまたは現在のProject／Threadから選べる。
- **Office系の成果物に対応する。**
  - Excel相当のスプレッドシート、PowerPoint相当のプレゼンテーション、文書、PDFを生成・編集する。
  - 初期段階では専用ビューアをRuxex本体に持たず、外部アプリや既存のプレビュー経路に委ねる。
- **複数エージェントをローカルで協調させる。**
  - クラウドの並列エージェントではなく、ローカルのThread、Process、Worktreeを組み合わせる。
- **プラグインをCodexのPlugin相当として育てる。**
  - Skills、標準MCP、MCP OAuth、Hooks、ローカルツール、必要ならUIを1つの拡張単位にまとめる。
  - OpenAIの登録済みConnected AppsやConnector IDには依存しない。
  - Ruxex独自のMarketplaceと接続管理で、コミュニティPluginを使えるようにする。
- **ブラウザ操作に対応する。**
  - TauriのWebViewは表示・観察用に活用し、操作エンジンはPlaywrightなどを別プロセスで持つ案を第一候補にする。

## 2. 接続済みアプリ／コネクタとは何か

接続済みアプリは、AIが外部サービスのデータを読んだり、許可された操作を実行したりするための認証済み接続である。単なるファイル添付ではなく、例えば次のようなものを指す。

- Gmailから未処理メールを検索する。
- Google DriveやMicrosoft 365から資料を読む。
- Slackから障害に関する会話を集める。
- LinearやGitHubのIssueを作成・更新する。
- カレンダーの予定を確認する。

通常はOAuthやAPIキー、サービス側の権限、読み取り／書き込み操作の範囲、実行前承認が必要になる。つまり、コネクタは「外部アプリのAPIを安全なAIツールとして包むもの」である。

### Codexにもあるか

ある。OpenAI公式資料では、CodexのPluginがSkills、接続済みアプリ、MCP、アプリテンプレートなどを組み合わせる仕組みとして説明されている。

- [Plugins in ChatGPT and Codex — OpenAI Help Center](https://help.openai.com/en/articles/20001256-plugins-in-codexOpenAI)
- [Plugin development for ChatGPT and Codex — OpenAI Developers](https://developers.openai.com/plugins?device=c)
- [Codex for (almost) everything — OpenAI](https://openai.com/index/codex-for-almost-everything/)

Ruxexでは、次のように整理すると分かりやすい。

```text
Plugin
├─ Skill: 使い方・判断手順・成果物ルール
├─ MCP server / Tool: 外部サービスやローカル機能への操作口
├─ Connection: OAuth・APIキー・権限スコープ
├─ UI metadata: 設定画面・状態表示・承認表示
└─ Assets: スクリプト・テンプレート・サンプル
```

Ruxexの既存のPlugins、Skills、MCPはこの方向に拡張できる。まずは「Plugin = 外部アプリ接続」と固定せず、SkillだけのPluginも許可する。互換性の中心は、OpenAI固有の登録済みAppではなく、コミュニティが利用できる標準的なPlugin、MCP、OAuthである。

現行コード上も、Plugin Marketplaceの一覧・導入・更新・削除に加えて、MCPのOAuthログイン用 `mcpServer/oauth/login`、OAuth完了通知、MCPごとの `authStatus`（OAuth、Bearer token、未ログインなど）はすでにApp Serverプロトコルに存在する。ただし、OAuthログインHookはあるもののCapabilities画面からの接続開始・接続解除・複数アカウント管理まではまだ一貫したUIとして提供していない。

### 実装開始の事実

- 最初は、既存のMCP OAuthフローにCapabilities画面のConnectボタンを接続する。
- Connectボタンは既存の `mcpServer/oauth/login` と `useMcpOauthLogin` を使う。
- App Serverが返す認証URLは、既存のTauri Native commandを通じてOSの既定ブラウザで開く。
- OAuth callback、authorization codeの交換、資格情報の保存、OAuth完了通知は既存のApp Server側の処理を使う。
- OpenAI固有のConnected apps用プロトコルやConnector ID互換は実装対象にしない。
- 将来追加する接続管理は、Ruxexのローカル実行モデルに合わせたApp／Connection層として設計する。

## 3. Excel／PowerPoint対応とSkills

「ExcelやPowerPointに対応する」は、ビューアだけでなく、次の3層に分けると実装しやすい。

1. **生成**: `.xlsx`、`.pptx`、`.docx`、`.pdf`を作る。
2. **検証**: ファイルが開けるか、表計算の数式やスライドの構造が壊れていないかを確認する。
3. **プレビュー**: Ruxex内または外部アプリで内容を見せる。

最初は3を外付けにしてよい。ただし、1と2はSkillの責務として残す。

### Skillの定義案

RuxexのSkillは、単なる長いプロンプトではなく、再現可能なワークフローのパッケージにする。

```text
spreadsheet-report/
├─ SKILL.md              # いつ使うか、手順、禁止事項、出力規約
├─ scripts/              # xlsx生成・検証・変換
├─ templates/            # 会社・プロジェクト用の雛形
├─ examples/              # 入出力例
└─ manifest.json         # 必要ツール、権限、対応ファイル形式
```

### 初期Skill候補

- **Spreadsheet Skill**
  - CSVやJSONを読み、表、数式、集計、グラフを含む`.xlsx`を生成する。
  - 生成後にファイルを開けるか、数式セルが存在するかを検証する。
- **Presentation Skill**
  - Markdownや依頼文からスライド構成を作り、`.pptx`を生成する。
  - スライド枚数、タイトル、画像、ノート、レイアウトを検証する。
- **Document／PDF Skill**
  - Markdownや調査結果から`.docx`や`.pdf`を作る。
  - ページ数、見出し、表、画像、リンクを検証する。

実装ライブラリは後で選定するが、ローカル生成の候補はPython系の表計算・プレゼン・DOCX・PDFライブラリ、またはLibreOfficeのヘッドレス変換である。Skillのインターフェースを固定し、ライブラリはSkill内部に閉じ込める。

## 4. 複数エージェントに追加する機能

Ruxexでは「エージェントを増やす」だけでは不十分で、親Taskから子Taskを安全に管理できることが重要になる。

### ローカルMVP

- **Coordinator Thread**: 全体の目的、完了条件、分担を保持する親Thread。
- **Sub-agent spawn**: 役割、依頼、入力ファイル、出力形式を指定して子Threadを作る。
- **Parallel execution**: 子Threadを並列に実行する。
- **Worktree isolation**: コード変更を子ThreadごとのGit worktreeに分離する。
- **Activity aggregation**: 子Threadの状態、質問、承認要求、成果物、失敗を親Threadに集約する。
- **Steering**: 子Threadを一時停止、再開、追加指示、キャンセルする。
- **Review gate**: 子Threadの変更を親Threadがレビューしてから採用する。
- **Resource controls**: 最大同時数、実行時間、CPU／メモリ、ツール権限を制限する。

### 具体例

```text
親Task: 認証画面を刷新する
├─ Agent A: React UIを実装する        → worktree/ui
├─ Agent B: API契約とテストを確認する  → worktree/api
├─ Agent C: 既存画面の回帰箇所を調査   → read-only
└─ Coordinator: 結果を比較し、採用案をレビューする
```

クラウド対応をしないなら、最初から「何日も放置して自律的に動き続ける」より、ローカルの並列実行、可視化、停止、レビュー、Worktree隔離を優先する。

## 5. Pluginは拡張機能に相当するか

相当する。ただし、RuxexでのPluginは次のような拡張パッケージとして定義すると、CodexのPlugin相当になりつつ、Ruxexのローカル性も保てる。

- Skillだけを追加するPlugin
- MCP serverだけを追加するPlugin
- ローカルアプリやファイル形式に接続するPlugin
- Spreadsheet／Presentationなどの成果物Skillを追加するPlugin
- 設定画面や状態表示を追加するPlugin

必要な設計要素は、Manifest、バージョン、権限、秘密情報の要求、ローカルプロセスの起動方法、承認ポリシー、アンインストール方法である。なお、RuxexにはすでにApp Server経由のPlugin Marketplaceがあり、Git／ローカルMarketplaceの追加、一覧、更新、削除、Pluginインストールを扱える。したがって、Pluginの配布・実行基盤は当面の互換性要件を満たしている。残る優先課題はOpenAIのConnected Appsを再現することではなく、Ruxex自身のConnect／Disconnectボタン、OAuth状態、権限スコープ、再認証、実行前承認をPluginの接続UXとして揃えることである。

## 6. ブラウザ操作の実装案

### 結論

TauriのWebViewとPlaywrightを組み合わせる方向はよい。ただし、**PlaywrightでRuxex自身のTauri WebViewを直接操作する**より、**Playwrightが管理するブラウザを別プロセスで動かし、Tauri WebViewは操作画面と観察画面にする**方が安全で実装しやすい。

Playwrightはブラウザの起動・操作ができ、既存ChromiumへCDP接続もできる。ただし、CDP接続は通常のPlaywright接続より低い忠実度で、Chromium系に限定される。[Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)

現行RuxexのBrowser／Computer Useは、実行エンジンそのものではなく、App Serverを権威とする設定・能力・イベント・表示の土台である。`config/read` と `configRequirements/read` でBrowser／Computer Useの可否、originごとのアクセス、ダウンロード、アップロード、Full CDP、Auto Review、永続承認、承認期間などを取得できる。Threadの `dynamicTools` でブラウザ操作ツールの名前・説明・JSON Schemaを注入し、サーバーから `item/tool/call` を受け、テキスト・画像・音声を返す形が、Playwright sidecarを差し込む場所になる。現行UIには `imageView` とdynamic toolの画像表示があり、外部HTTP(S) URLを開くNative commandもあるが、汎用ブラウザ操作の実行Driverはまだ別途実装する必要がある。

### 推奨アーキテクチャ

```text
Ruxex App Server
  └─ BrowserController trait
      ├─ open(url)
      ├─ snapshot()
      ├─ click(target)
      ├─ fill(target, value)
      ├─ press(key)
      ├─ screenshot()
      ├─ download()
      └─ close()

Browser sidecar
  └─ Node.js + Playwright
      ├─ managed Chromium context
      ├─ screenshot / DOM snapshot
      ├─ action execution
      └─ event stream to App Server

Tauri UI
  └─ Browser panel
      ├─ screenshot / page state display
      ├─ user annotation
      ├─ approval dialog
      └─ stop / pause
```

### 段階的な実装

1. **Phase 1: 管理ブラウザ**
   - PlaywrightがChromiumを起動する。
   - localhostと明示的に許可したドメインだけを対象にする。
   - `open`、`snapshot`、`click`、`fill`、`press`、`screenshot`を提供する。
   - 送信、購入、削除、外部への投稿、ファイルアップロードは承認必須にする。
2. **Phase 2以降: 既存Chromiumへの接続（任意）**
   - CDPでユーザーが起動したChromiumに接続する。
   - 既存ログイン状態を使えるが、Cookie・タブ・秘密情報の境界を明示する。
3. **Phase 3以降: ブラウザ拡張（任意）**
   - 普段のChromeタブを対象にしたい場合に、専用拡張からタブ情報と操作権限を渡す。
   - 拡張を必須にせず、管理ブラウザを標準経路として残す。
   - 既存ブラウザのタブやログイン状態を操作する必要が出た場合だけ検討する。

### 最初から必要な安全策

- ドメイン許可リストと外部遷移確認
- 操作ごとの可逆性分類
- 送信・削除・購入・アップロードの承認
- スクリーンショット・DOMスナップショットからの秘密情報マスキング
- ブラウザContextの分離
- 任意JavaScript実行を標準ツールにしない
- ブラウザ側のイベント、実行者、対象URL、承認者をActivityに記録

PlaywrightのBrowserContextはCookieやStorageを分離した独立環境を作れるため、管理ブラウザの初期実装と相性がよい。[Playwright Browser Context](https://playwright.dev/docs/browser-contexts)

## 7. 仮の優先順位

1. グローバルショートカット＋小型パネル（スクリーンショット、音声入力、短い依頼）
2. BrowserController＋管理Chromium＋承認境界
3. Plugin接続UX（Connect／Disconnect、OAuth状態、権限スコープ、再認証）
4. Coordinator／Sub-agent／Worktreeによるローカル並列実行
5. Spreadsheet／Document／Presentation Skill
6. Playwright adapterを維持したまま、Lightpandaなどの省メモリBrowser runtimeを比較検証

既存ChromiumへのCDP接続とブラウザ拡張は、管理ブラウザで不足する具体的なユースケースが出た場合に追加する任意機能とし、初期ロードマップには含めない。

## 8. 今後決めること

- グローバルショートカットのOS別実装と初期ショートカット
- 音声認識エンジンをローカル処理にするか、ユーザーが選べるProviderにするか
- スクリーンショットの範囲選択とアプリウィンドウ取得の権限モデル
- Office生成ライブラリとLibreOfficeの採用範囲
- SkillのManifest schemaとPluginのバージョン互換性
- 子Agentのモデル・Providerを親Taskと同じにするか、個別に選べるようにするか
- ブラウザの標準対象をlocalhostに限定する期間
- CDP接続時のログインCookieと秘密情報の扱い
