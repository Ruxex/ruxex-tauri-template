# Codex Desktop の機能・設定リファレンス

調査日: 2026-11-12
対象: ChatGPT デスクトップアプリ内の Codex

## この文書の読み方

Codex Desktop は、単一のコード編集チャットではなく、ローカルのプロジェクト、Git worktree、Codex Cloud、ブラウザー、デスクトップアプリ、ターミナル、スキル、プラグイン、スケジュールを一つのワークスペースから扱うためのコーディングエージェント環境である。

ここでは、デスクトップアプリから直接使える機能、設定、権限、OS差分、利用できない組み合わせまで整理する。CLI／IDE拡張だけの機能は原則対象外とし、デスクトップから利用できる Cloud、Browser、Remote な作業は対象に含める。

### 重要な前提

- 利用可否は、macOS／Windows／Linux、ChatGPT プラン、ワークスペースのロール、管理者ポリシー、地域、段階的ロールアウト、接続先の認証状態で変わる。
- 「公式資料に記載されている」ことと、「すべてのアカウントで現在使える」ことは同じではない。
- Local、worktree、Cloud は別の実行場所であり、ファイル、認証情報、ネットワーク、端末を閉じたときの挙動が異なる。
- ChatGPT の Chat／Work と Codex は同じデスクトップアプリに入っているが、作業モードと履歴・権限・実行場所は区別して考える。

### Ruxex での提供可否マーク

- `◎ OpenAIバックエンド依存`: OpenAI のモデル推論、ChatGPT アカウント／同期、OpenAI 管理の Cloud・Relay・ホストサービスが機能の成立条件になる。Ruxex のローカルアプリだけでは同等機能を提供できない。
- `△ 部分依存`: 画面、ファイル、OS操作などのローカル部分は Ruxex で実装できるが、Codex としての判断・生成・認証・公式連携は OpenAI バックエンドに依存する。
- `○ ローカル実装可能`: OpenAI のホストサービスを前提にしない、OS、Git、ファイル、sandbox、設定などのクライアント側機能。別のモデルやサービスを組み合わせる場合は別途依存する。

ここでいう「OpenAIバックエンド」は、単にインターネットへ接続することではなく、OpenAI のモデル、ChatGPT のアカウント・履歴・同期基盤、Codex Cloud、Remote relay、OpenAI がホストする機能を指す。GitHub、ブラウザー、OS、外部 MCP などの第三者依存は別扱いにする。

## できることの早見表

| マーク | 分類 | デスクトップでできること | 主要な注意点 |
| --- | --- | --- | --- |
| ◎ | AI推論・エージェント実行 | OpenAI のモデルで指示を解釈し、計画、ツール選択、コード生成、回答を行う | Ruxex 単体では OpenAI バックエンドまたは別モデル基盤が必要 |
| △ | ワークスペース | プロジェクト、フォルダー、最近のチャット、長期作業を一つの画面で扱う | フォルダー表示はローカル、履歴・同期・Codex コンテキストは OpenAI 側に依存 |
| △ | 実行場所 | Local、Git worktree、Codex Cloud を選ぶ | Local／worktree は端末上、Cloud は OpenAI 管理の環境で実行 |
| △ | 並列作業 | 複数のチャット・プロジェクト・エージェントを並行して進める | 画面上の並列化はローカル、複数エージェントの推論・状態管理は OpenAI 側に依存 |
| ◎ | 長時間作業 | /goal で成果・制約・完了条件を持つ作業を継続する | Goal のエージェント実行・状態管理は Codex のバックエンド機能 |
| ○ | Git | ブランチ、変更、worktree、複数リポジトリを扱い、レビューする | worktree は Git リポジトリでのみ利用可能。AIレビュー部分は別途 `◎` |
| △ | ターミナル | 現在のプロジェクト／worktree を対象にコマンドを実行する | ターミナル自体はローカル、コマンドの提案・実行判断は OpenAI 側に依存 |
| ◎ | コードレビュー | PR、ブランチ、コミット、ファイル、複数リポジトリの変更をレビューする | 差分取得はローカル／GitHub、レビュー判断・要約・指摘生成は OpenAI 側 |
| ◎ | ブラウザー | Web 調査、ログイン済みページ、localhost のプレビュー、コメント・注釈 | Browser UI はローカルでも、エージェント操作・Web調査・コメント生成は OpenAI 側に依存 |
| ◎ | Computer Use | macOS／Windows の GUI アプリを認識し、クリック・入力・設定変更を行う | 画面取得・入力は端末、Computer Use の認識・操作判断は OpenAI 側 |
| △ | Appshots | 最前面アプリの画面と取得可能なテキストをチャットへ添付する | 撮影はローカル、画像の理解・応答は OpenAI モデルに依存 |
| ◎ | 音声 | 音声で作業を開始、進捗確認、方向変更、別タスクへの切り替えを行う | 音声認識・音声合成・Codex応答が OpenAI のサービスに依存 |
| △ | ファイル | コード、文書、表計算、画像、PDFなどを作成・確認する | ファイル操作・プレビューはローカルでも、生成・変換・内容理解はモデル／スキルに依存 |
| ◎ | 画像生成・画像入力 | 画像を新規生成・編集し、スクリーンショット、図、デザインをコンテキストとして渡す | 画像生成モデル、画像理解、利用上限は OpenAI 側。添付・保存だけならローカル |
| ◎ | 可視化 | グラフ、地図、図、計算機、シミュレーションなどの対話的プレビューを作る | 可視化の生成・対話ロジックは OpenAI 側。表示領域はデスクトップ側 |
| ◎ | Sites | プロンプトや互換ローカルプロジェクトからサイトを作り、レビュー、公開、共有する | Sites の生成・管理・ホスティング・公開基盤が OpenAI 側 |
| ◎ | Remote connections | 別の Mac／Windows、モバイル、SSH ホストへ接続し、チャット・プロジェクト・Git 状態を引き継ぐ | SSH自体はローカルでも、ChatGPTの認証、リレー、クロスデバイス同期は OpenAI 側 |
| △ | スキル | 指示、リソース、スクリプトを再利用可能なワークフローとして追加する | ファイル・スクリプトはローカル、Codex の自動選択・解釈・実行判断は OpenAI 側 |
| ◎ | プラグイン | MCP server、スキル、外部サービスをまとめて追加する | プラグインカタログ、認証、Codexからのツール選択は OpenAI 側。MCP実行先は外部依存 |
| ◎ | WebMCP | 対応サイトが提供するサイトツールを内蔵ブラウザーから使う | 対応モデル、検出、ツール呼び出し、ワークスペース提供が OpenAI 側 |
| △ | スケジュール | 定期タスク、チャット内のフォローアップ、RRULEを使った繰り返しを設定する | ローカル時間実行は実装可能、Cloud・Web／モバイル・イベント起動は OpenAI 側 |
| ○ | Hooks | Codex のライフサイクルイベントで決定論的なスクリプトや MCP tool を実行する | フック実行、設定、sandbox はローカル実装可能。Codex固有のイベント連携は別途設計が必要 |
| ○ | 安全性 | sandbox、承認、ネットワーク制御、permission profile を組み合わせる | OS sandbox・ローカル承認は実装可能。OpenAI 管理ポリシーは再現できない |

## OpenAIバックエンド依存の境界

Ruxex の機能要件から除外する対象を明確にするため、デスクトップの見た目ではなく、処理の成立条件で分ける。

### Ruxex では提供しないもの【◎】

- OpenAI のモデルによる Codex の推論、計画、コード生成、ツール選択、回答生成。
- Codex Cloud、Cloud environment、Cloud 上の長時間タスク、Cloud 固有の環境公開・ワークスペース作成。
- Goal のような Codex 固有のエージェント状態管理、OpenAI 側で継続する長時間作業。
- ChatGPT の履歴、Memory、Profile のトークン統計、招待、クロスデバイス同期。
- OpenAI の音声認識・音声合成・Voice タスク制御。
- OpenAI の画像生成モデル、画像理解、Visualize の生成・対話ロジック。
- OpenAI Sites の生成、管理、ホスティング、公開、共有。
- Web 検索、WebMCP、内蔵 Browser を使った OpenAI 管理のエージェント操作。
- Computer Use の画面理解・操作計画・操作実行を担う OpenAI サービス。
- Remote Control の ChatGPT 認証、端末ペアリング、リレー、クロスデバイスのチャット引き継ぎ。
- OpenAI のプラグインカタログ、接続認証、Codex によるプラグイン／MCP ツールの選択。
- Web／モバイルのイベントトリガー、OpenAI 側で保持・実行されるスケジュールタスク。

### Ruxex でローカル代替を検討できるもの【△】

- チャット画面、プロジェクト、フォルダー、履歴一覧、通知、並列タスクの表示。ただしモデル呼び出しと同期は別バックエンドが必要。
- 統合ターミナル、Git、worktree、ファイル操作、成果物プレビュー。ただし自然言語からの操作判断・生成はモデルが必要。
- Browser のウィンドウ、ログイン済みプロファイル、localhost プレビュー、Appshots の撮影。ただしページ理解、Web調査、画像理解、コメント生成はモデルが必要。
- 画像添付、スキルのファイル・スクリプト、ローカルスケジューラー、MCP サーバー接続。ただし自動選択・引数生成・結果解釈はモデルまたは外部サービスが必要。
- Code review の差分取得・表示。ただしレビュー指摘の生成にはモデルが必要。

### Ruxex で実装可能な基盤【○】

- OS のウィンドウ、ファイル、ターミナル、Git、worktree、ローカル通知、設定画面。
- Hooks、sandbox、Permission profile、承認ダイアログ、ローカル環境セットアップ。
- Appshots の撮影・保存、画像や成果物のローカルプレビュー、チャットのUI部品。

`○` の機能も、AIエージェントとして動かすには別のモデルまたはサービスが必要になる場合がある。ここでの `○` は「OpenAIバックエンドを機能の必須条件にしない」という意味であり、完全オフラインで全機能が動くことを保証するものではない。

## 1. 起動と作業の開始

### 1.1 アプリの基本フロー【△ 部分依存】

1. ChatGPT デスクトップアプリをインストールしてサインインする。
2. 新しいチャット、既存のプロジェクト、またはローカルフォルダーを選ぶ。
3. ChatGPT の切り替えから Codex を選ぶ。
4. Codex の新しいチャットで作業場所を選ぶ。
5. 依頼、成果物、制約、完了条件、確認してほしいファイルを送る。

Codex の起点は New chat である。デスクトップアプリ共通の Quick chat は短い質問向けの機能で、Codex のローカル実装作業や長期作業の代替ではない。

### 1.2 プロジェクトとコンテキスト【△ 部分依存】

- プロジェクトまたはフォルダーを選ぶと、その場所のファイルとコンテキストを使って作業できる。
- 最近のチャットから長期作業へ戻り、同じコンテキストを保ったまま追加指示を送れる。
- 複数プロジェクトを切り替え、チャットを並行して進められる。
- ファイル、コード差分、ターミナル、レビュー結果、ブラウザーのプレビューを同じ作業の近くで確認できる。
- 別のアプリの横にチャットを切り離して表示でき、Always on top を使えば常に最前面に固定できる。

## 2. 実行場所

新しい Codex チャットでは、次の3つから作業場所を選ぶ。Local と worktree は自分のコンピューターで実行され、Cloud はリモート環境で実行される。

### 2.1 Local【○ ローカル実装可能】

現在のプロジェクトディレクトリで直接ファイルを読み書きする。現在のチェックアウト上の未コミット変更を扱えるが、作業中のファイルをスケジュール済みタスクが変更する可能性がある。

### 2.2 Git worktree【○ ローカル実装可能】

Git リポジトリから別のチェックアウトを作り、作業を分離する。

- Git リポジトリでのみ利用できる。
- 各 worktree はファイルの独自コピーを持つが、コミット、ブランチなどの .git メタデータは共有する。
- ベースとして main／master、機能ブランチ、未ステージ変更を含む現在のブランチを選べる。
- 既定では detached HEAD で作業する。
- Codex 管理の worktree は軽量で、通常はチャット単位で使い捨てやすい。チャットへ戻ると同じ worktree に戻る。
- 長期利用が必要なら、プロジェクトのメニューから永続 worktree を作成できる。永続 worktree は自動削除されず、複数チャットから利用できる。
- Local と worktree の間でチャットを移す Handoff があり、必要な Git 操作を Codex が処理する。
- 新しい worktree の作成時に、ローカル環境で設定したセットアップスクリプトを自動実行できる。

### 2.3 Codex Cloud【◎ OpenAIバックエンド依存】

端末がスリープしても作業を継続できる、リモートの専用ワークスペースでコーディングタスクを実行する。

- リポジトリ、依存関係、ツール、アクセス設定をまとめた再利用可能な Cloud environment を使用する。
- デスクトップアプリまたは Web から環境を作成し、GitHub リポジトリを選択し、依存関係・ツールのセットアップとテストを行い、確認後に公開する。
- 公開済み環境から開始した各タスクには独立したワークスペースが作られる。
- デスクトップ、Web、モバイルからコード編集、コマンド実行、結果確認を行える。
- Cloud タスクには、アクセス可能な公開済み環境が必要。環境の使用権限があっても、環境の編集権限が与えられるとは限らない。
- Codex Cloud (Legacy) は旧来のコードレビュー、Linear、GitHub 連携を支える別エクスペリエンスであり、廃止予定として扱われている。

Local／worktree と Cloud は同じ作業場所ではない。ローカルファイル、端末上の資格情報、GUI アプリ、内蔵ブラウザーのセッションを Cloud タスクから直接利用できるとは限らない。

### 2.4 Remote connections と SSH【◎ OpenAIバックエンド依存】

Remote connections は Cloud の代替実行環境ではなく、別のコンピューターをホストとして使う接続機能である。デスクトップアプリを macOS／Windows のホストで起動し、モバイルまたは別の対応デスクトップアプリから、同じプロジェクト、チャット、ファイル、資格情報、権限、プラグイン、Browser、Computer Use、ローカルツールを利用できる。

- Settings > Connections から「Control this Mac or PC」を設定し、QR コードでスマートフォンをペアリングする。利用可能な OS、モバイルアプリ、ワークスペース、ロールアウトに依存する。
- ホストがスリープ、オフライン、アプリ終了になるとリモートアクセスも停止する。必要なら接続設定の Keep this computer awake を使う。
- 別の Mac／Windows から「Control other devices」でホストを追加し、同じチャットを別端末で引き継げる。Remote Control の利用を管理者が有効にする必要がある場合がある。
- デスクトップアプリの Settings > Connections から SSH ホストを追加し、リモートのファイルシステムとシェルに対してチャットを実行できる。SSH config の具体的な Host alias、疎通、リモート側の codex コマンド、プロジェクト保存が必要。
- Handoff では、同じ Git リポジトリの保存済みプロジェクト間でチャットと Git 状態を移し、宛先に worktree を作成または再利用する。実行中なら現在の応答を中断してから移行する。
- リモート接続でも、接続先ホストの sandbox、承認、権限、認証状態がそのまま効く。app-server を公開ネットワークへ直接公開せず、必要なら VPN や mesh networking を使う。
- Codex Cloud 環境への Handoff はサポートされない。Cloud は公開済み Cloud environment と独立したクラウドワークスペースを使う別の仕組みである。

## 3. エージェント作業と長期タスク

### 3.1 並列作業【△ 部分依存】

複数のチャット、プロジェクト、エージェントを並行して実行し、サイドバーで進捗と結果を追跡できる。タスクごとに作業場所、worktree、接続先、書き込み権限を分けると、変更の衝突を減らせる。

同じリポジトリ、同じブランチ、同じ外部サービスへ複数タスクから同時に書き込む設計は避ける。並列化できる読み取り・調査タスクと、順序依存の書き込み・デプロイタスクを分ける。

### 3.2 Goal モード【◎ OpenAIバックエンド依存】

多段階の作業では、成果、制約、完了の定義を明示し、関連作業を同じチャットで続ける。チャットに /goal と入力すると Goal モードを開始できる。

進捗行から次を操作できる。

- 目標を一時停止する
- 一時停止した目標を再開する
- 目標を編集する
- 目標をクリアする

Goal は「長時間作業を端末から切り離す」機能そのものではない。端末を閉じても継続させたい場合は Cloud タスクを使う。

### 3.3 Activity と通知【△ 部分依存】

- サイドバーの Activity view で未読、実行中、回答待ちのチャットを確認できる。
- Activity view の表示対象は、環境によって Work、Chat、Pinned、Scheduled などから選べる。
- Mark all as read で未読をまとめて既読にできる。
- macOS は Cmd+Option+U、Windows は Ctrl+Alt+U で Activity view を開閉できる。
- ターン完了通知は、常に表示、アプリがバックグラウンドのときだけ表示、表示しない、から選べる。
- 権限通知と質問通知は個別にオン／オフできる。OS側の通知権限も必要になる場合がある。
- 任意のフローティングペットを使う場合、Running、Needs input、Ready、Blocked の状態を別ウィンドウから確認できる。

## 4. スケジュール済みタスク

### 4.1 作成方法【△ 部分依存】

- 保存したプロンプトから毎回新しいチャットを開始する独立したスケジュール済みタスク。
- 既存チャットのコンテキストへ戻るチャット内のスケジュール済みタスク。
- デスクトップアプリの Scheduled ビューで、実行中、一時停止中、完了済み、最近の実行履歴を確認する。
- カスタムスケジュールには RFC 5545 の RRULE を使える。例: RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0。
- Codex チャットから、作業内容、実行時刻、既存チャットへ戻るか新規チャットにするかを指定して作成・更新できる。
- スキルはスケジュール済みタスクから明示的に呼び出せる。デスクトップでは $skill-name を使える。

### 4.2 Local プロジェクトとの関係【○／△ 混在】

- Local プロジェクトまたは worktree に連携したタスクは、実行時にコンピューターの電源が入り、デスクトップアプリが起動している必要がある。
- Git リポジトリでは、既存の Local checkout で実行するか、専用 worktree で分離するかを選べる。
- worktree を選ぶと未完了のローカル作業を保護しやすい。Local を選ぶと現在編集中のファイルが変更される可能性がある。
- バージョン管理されていないプロジェクトでは、プロジェクトディレクトリで直接実行される。
- モデルと推論強度は既定値のままにも、明示的にもできる。
- 無人実行のため既定の sandbox 設定が使われる。最小権限から始め、ネットワークや広いファイルアクセスは必要なときだけ許可する。

### 4.3 イベントトリガーとの違い【◎ OpenAIバックエンド依存】

Gmail、Slack、GitHub のイベントでタスクを起動するイベントトリガーは Web／モバイル向けであり、現行ドキュメントでは ChatGPT デスクトップアプリ、Codex CLI、IDE 拡張機能では利用できない。したがって、デスクトップでは時間ベースのスケジュールを使う。

## 5. 開発ワークフロー

### 5.1 統合ターミナル【△ 部分依存】

各チャットに、現在のプロジェクトまたは worktree を対象とする統合ターミナルがある。

- アプリ右上のターミナルアイコンから開く。
- Ctrl+バッククォートで開閉する。
- 依存関係のインストール、テスト、ビルド、開発サーバー起動、Git 操作をチャットの近くで実行できる。
- ターミナルの出力とエージェントの活動ログは別物として確認する。

### 5.2 コードレビュー【◎ OpenAIバックエンド依存】

コミットまたはプッシュ前に、Codex へ次の対象とレビュー基準を指定して変更をレビューさせる。

- pull request
- ブランチ
- コミット
- ファイル
- 前回ターンでの変更

複数のフォルダーが複数の Git リポジトリに対応している場合、レビューのリポジトリセレクターで対象を切り替えられる。リポジトリごとにステージ済み、未ステージ、ブランチなどのレビュー範囲を適用できる。

レビューでは、指摘、変更理由、チェック結果、次に行う修正を確認する。プルリクエストの取得やコメントなど外部サービスを使う場合は、対応するプラグインと認証が必要になる。

### 5.3 ファイルと成果物【△ 部分依存】

デスクトップアプリでは、コード以外にもドキュメント、スプレッドシート、画像、PDFなどの実ファイルを作成・確認できる。生成後は同じワークスペースでプレビューし、内容をレビューして次のバージョンへの修正を依頼できる。

利用可能な形式、プレビュー、変換、画像生成は、アカウント、スキル、プラグイン、接続された artifact ツールに依存する。成果物のパス、生成に使ったコマンド、実行したチェックを必ず記録させると再現性を保ちやすい。

### 5.4 画像入力と画像生成【◎／△ 混在】

画像入力は、スクリーンショット、ワイヤーフレーム、図、デザイン、既存アセットをチャットの参照情報として渡す機能である。Composer へ Shift を押しながら画像をドラッグし、画像の目的、重要な領域、期待する出力、サイズ・形式・色などの制約を説明すると精度を上げやすい。複数画像を渡す場合は、各画像の役割と比較したい点を明記する。

画像生成はデスクトップの Composer から新規画像を作成したり、添付した参照画像を編集したりする機能である。UI アセット、バナー、背景、イラスト、スプライト、プレースホルダーなどを生成できる。$imagegen を明示すると画像生成スキルを直接呼び出せる。生成後は Focused view／Canvas view、コメント、複数選択を使ってレビューし、全体を作り直すのではなく変更箇所を限定して反復する。

- 画像入力は「理解・比較・実装の参照」、画像生成は「新規作成・編集」として使い分ける。
- 組み込みモデル、利用上限、プラン、ロールアウトは変わる。現行ドキュメントでは gpt-image-2 と平均の3〜5倍程度の利用上限が案内されているが、アカウントごとの上限を優先する。
- 大量生成では API の OPENAI_API_KEY を使う方法が案内される場合がある。その場合は ChatGPT の利用枠ではなく API 課金になるため、キーをリポジトリへ保存しない。
- 参照画像には著作権、個人情報、秘密情報が含まれ得る。入力・生成物・保存先をレビューし、公開前にライセンスと機密性を確認する。

### 5.5 可視化と対話的プレビュー【◎ OpenAIバックエンド依存】

Visualize は、数値データや説明をグラフ、地図、図、計算機、シミュレーションなどの対話的なプレビューへ変換する機能である。Composer から @Visualize を選び、見せたい関係、操作方法、データ範囲、単位、色分け、出力サイズを指定する。説明だけでは伝わりにくい比較、時系列、状態遷移、パラメーター変更の確認に向く。

- デスクトップアプリではチャット内のインタラクティブプレビューを確認し、追加条件を送って反復できる。
- CLI／IDE 拡張機能では同じ可視化のレンダリングを表示できない。必要なら静的な出力やコードを生成して別のビューアで確認する。
- 可視化はローカルのサイトを公開する機能ではない。永続 URL、認証、データ保存、利用者向けのアプリが必要なら Sites を使う。

### 5.6 Sites【◎ OpenAIバックエンド依存】

Sites は、プロンプトから新しいサイトを作成するか、互換性のあるローカルプロジェクトを読み込み、サイトをレビュー、修正、管理、共有するためのデスクトップ機能である。生成した UI を Browser で確認し、指示や注釈をもとに反復できる。

- 保存済みバージョンを作る操作と、本番環境へ deploy して公開 URL を更新する操作を分けて扱う。
- サイトのデータ、権限、認証、共有範囲は、生成したコードとは別に確認する。公開前に秘密情報、外部 API キー、個人データ、アクセス制御をレビューする。
- CLI／IDE 拡張機能には、Sites を単独で作成・管理・公開するデスクトップ相当の管理画面はない。ローカルプロジェクトとしてのコード編集は可能でも、公開操作の可否は環境に依存する。

## 6. ブラウザーとコンピューター操作

### 6.1 内蔵 Browser【◎ OpenAIバックエンド依存】

内蔵 Browser は ChatGPT デスクトップアプリだけで利用できる。Codex CLI と IDE 拡張機能には内蔵ブラウザーがない。

できること:

- Web サイトを開き、最新情報を調査する。
- 複数ステップの Web 操作を実行する。
- ローカル開発サーバー、ファイルベースのページ、公開ページを開く。
- コード差分とレンダリング結果を横に並べて確認する。
- ページ上の要素や領域へブラウザーコメントを付け、変更範囲を限定して修正を依頼する。
- 全体表示と、チャット＋タブの分割表示を切り替える。Cmd+Shift+B（Windows／Linux は Ctrl+Shift+B）で切り替える。
- アドレスバーから閲覧履歴を検索し、該当がなければ Google 検索を行う。

内蔵ブラウザーは通常の Chrome とは別のプロファイルと閲覧履歴を持つ。ログイン状態、Cookie、履歴を通常ブラウザーと自動共有するとは限らない。

### 6.2 ブラウザーでのプレビューと注釈【◎／△ 混在】

1. 統合ターミナルまたはローカル環境のアクションで開発サーバーを起動する。
2. localhost またはファイルベースのページを内蔵 Browser で開く。
3. 差分と並べてレンダリング結果を確認する。
4. 直したい要素や領域にコメントを残す。
5. コメントをもとに、対象範囲を限定した修正を依頼する。

注釈では、フォント、テキスト、間隔、色などのスタイル値を調整しながらプレビューできる。1回のブラウザータスクは、1ページ・1ルート・1つの状態など、確認可能な小さい範囲にする。

### 6.3 ブラウザー拡張機能【◎ OpenAIバックエンド依存】

ChatGPT デスクトップアプリから、ログイン済みブラウザープロファイルのページを参照・操作する拡張機能がある。

- Google Chrome、Microsoft Edge、Brave、Opera、Vivaldi に対応。
- 5ブラウザーすべてで、タブのメンションとブラウザー操作を利用できる。
- Chrome、Edge、Brave、Vivaldi はサイドチャットにも対応する。
- Opera はサイドチャットに対応せず、デスクトップアプリからタスクを開始する。
- LinkedIn、Salesforce、Gmail、社内ツールなど、すでにサインインしているサイトを対象にできる。
- セットアップ前にデスクトップアプリを更新する。ロールアウトやワークスペース設定によって利用できない場合がある。

### 6.4 WebMCP のサイトツール【◎ OpenAIバックエンド依存】

サイトツールは、対応サイトが人間向け画面と並行して AI エージェントへ直接提供する操作を、内蔵 Browser から検出・利用するための仕組みである。ユーザーとエージェントは、同じライブページ、サインイン済みセッションで作業できる。

現行ドキュメントの注意点:

- ChatGPT デスクトップアプリの内蔵 Browser で、ChatGPT Work と Codex が利用可能なサイトツールを検出する。
- 対応モデル、アプリのバージョン、ロールアウト、現在のページが提供するツールに依存する。
- 現行ページでは GPT-5.6 Sol または GPT-6 Sol の使用が案内されているが、モデル名・提供条件は更新される可能性がある。
- Enterprise／Edu ワークスペースでは利用できないと記載されている。

### 6.5 Computer Use【◎ OpenAIバックエンド依存】

Computer Use は、macOS／Windows の GUI を認識して、クリック、入力、ウィンドウ操作、アプリ設定の変更を行う機能である。

用途の例:

- 開発中の macOS／Windows アプリや iOS シミュレーターを操作してテストする。
- GUI でしか再現できないバグを再現する。
- ブラウザーでの操作や、プラグイン化されていないデータソースを扱う。
- 複数アプリにまたがるワークフローを実行する。
- macOS で別作業を続けながら限定的なバックグラウンド作業を行う。

条件と権限:

- 対応地域で、ChatGPT デスクトップアプリの ChatGPT Work と Codex から利用する。
- Computer Use プラグインをインストールする。
- macOS では、画面を認識するための画面収録、クリック・入力のためのアクセシビリティ権限を付与する。
- Windows では対象アプリを実行中、アクティブなデスクトップに表示したままにする。
- Settings > Computer Use で接続済みブラウザー、許可済みアプリ、Always-allowed apps を確認・管理する。
- Linux のデスクトップアプリプレビューでは Computer Use はまだ利用できない。

ローカルで構築している Web アプリの確認には、まず Computer Use ではなく内蔵 Browser を使う。

### 6.6 Appshots【△ 部分依存】

Appshots は最前面のアプリウィンドウをチャットへ添付する機能である。

- macOS は左右の Command キー同時押し、Windows は左右の Alt キー同時押しで撮影する。
- カスタムホットキーを設定できる。
- 最前面ウィンドウの画像と、アプリから取得可能な表示範囲外のテキストを含む場合がある。
- 添付後は通常のファイル／画像と同じように扱われ、セッションファイルへローカル保存される。
- CLI で既存 Appshot を含むチャットを再開することはできるが、CLI で新しい Appshot を作成することはできない。
- macOS のペットやフローティングコントロールから開始する場合も、メインアプリ側の Appshots 権限を先に設定する。
- 機密情報を含むウィンドウを共有しない。Google Docs、Gmail、Sheets、Slides などでは画面画像だけになり、画面外テキストを取得できない場合がある。

### 6.7 Web 検索【◎ OpenAIバックエンド依存】

デスクトップアプリのチャットから最新情報を検索できる。検索活動は、他のツール呼び出しとともにトランスクリプトへ記録される。検索結果やページ内容は信頼できない入力として扱い、コード・設定・資格情報を無条件に実行しない。

## 7. 音声、プラグイン、スキル、Hooks

### 7.1 ChatGPT Voice【◎ OpenAIバックエンド依存】

デスクトップアプリの Chat、Work、Codex で音声会話を使える。

- 応答中に割り込み、追加質問、方向変更ができる。
- 長時間タスクを開始し、進捗、障害、結果を音声で確認できる。
- 別の Codex タスクへ移動し、以前のタスクへ戻れる。
- 音声タスクにも通常の権限が適用される。
- macOS では Settings > Voice の Screen context を有効にすると、最前面ウィンドウの Appshot を会話コンテキストにできる。
- デスクトップアプリ全体で同時にアクティブな音声チャットは1つだけ。
- マイク権限、プラン、地域、ワークスペースの提供状況を満たす必要がある。

音声会話と、送信前に音声をテキスト化する音声入力は別機能である。

### 7.2 プラグイン【◎ OpenAIバックエンド依存】

プラグインは、再利用可能なワークフローとしてスキルや MCP server をまとめる配布単位である。

- ChatGPT と Codex は共通のプラグインディレクトリを使う。
- デスクトップアプリでは Chat、Work、Codex の対応画面から閲覧、インストール、利用する。
- 例: GitHub、Slack、Linear、Figma、デプロイ先、ドキュメント、PDF／表計算／DOCXなどのワークフロー。
- 利用にはプラグインのインストール、接続先の認証、ワークスペースの許可が必要。
- IDE 拡張機能はプラグインをサポートしない。
- Computer Use は通常のプラグイン接続では取れない GUI 操作を担う別の拡張である。

### 7.3 スキル【△ 部分依存】

スキルは、指示、参照資料、任意のスクリプトを SKILL.md と同じディレクトリにまとめ、タスク固有の専門知識や手順を再利用する仕組みである。

- SKILL.md の front matter には name と description が必要。
- 明示的な呼び出しと、description に基づく暗黙的なマッチングがある。
- 最初は名前と説明だけを一覧し、選択された時点で SKILL.md 全体を読む段階的開示を行う。
- Codex はリポジトリ、ユーザー、管理者、システムの場所からスキルを読む。
- リポジトリでは、現在の作業ディレクトリからルートまでの .agents/skills を検索する。
- 同じ name のスキルはマージされず、複数表示されることがある。
- 変更は自動検出される。表示されない場合は Codex を再起動する。
- スキル一覧のコンテキスト上限を skills.max_context_tokens で最大10,000トークンまで設定できる。この上限は初期一覧だけに適用される。

### 7.4 Hooks【○ ローカル実装可能】

Hooks は Codex のライフサイクルイベントでスクリプトまたは MCP tool を実行する決定論的な拡張点である。

用途の例:

- チャットをログ／分析基盤へ送る。
- プロンプトをスキャンして API key の誤貼り付けを防ぐ。
- 会話を要約し、永続メモリを作る。
- ターン終了時に検証を実行する。
- ディレクトリに応じてプロンプトをカスタマイズする。

主なイベント:

| 種類 | イベント |
| --- | --- |
| ターン中 | PreToolUse、PermissionRequest、PostToolUse、PreCompact、PostCompact、UserPromptSubmit、SubagentStop、Stop |
| 中断時 | Interrupt（サブエージェントでは実行されない） |
| セッション開始時 | SessionStart、SubagentStart |
| メインスレッド終了時 | SessionEnd（サブエージェントでは実行されない） |

設定の探索場所:

- ~/.codex/hooks.json
- ~/.codex/config.toml の inline [hooks]
- <repo>/.codex/hooks.json
- <repo>/.codex/config.toml
- プラグインのマニフェストまたは hooks/hooks.json

複数ファイルに一致したフックはすべて実行され、同じイベントのコマンドフックは並行起動される。セッションあたりバックグラウンドフックは最大8個で、セッション終了時に未完了のものはキャンセルされる。SessionEnd は常に同期実行される。モデルに渡すフック出力は既定で約2,500トークンに制限され、それを超える内容は一時ファイルへ spill される。

同期フックは承認、拒否、書き換え、ターン継続などを制御できる。バックグラウンドフックは、起動の原因となった操作を後からブロック・承認・書き換えできない。

## 8. 設定リファレンス

設定はアプリメニューから開く。macOS は Cmd+カンマ、Windows は Ctrl+カンマがショートカットである。Linux ではアプリメニューから開く。

### 8.1 General【○／△ 混在】

- Enter で送信するか、複数行またはすべてのプロンプトで Cmd+Enter（macOS）／Ctrl+Enter（Windows・Linux）を必要とするか。
- macOS／Linux で Prevent sleep while running を有効にし、席を離れている間もローカルチャットを継続するか。
- 実行中に送信したフォローアップを現在の実行へ追加するか、次の実行まで待たせるか。

### 8.2 Profile【◎ OpenAIバックエンド依存】

プロフィール情報、活動分析、累計／最大トークン、連続利用記録、最長タスク、トークン使用状況を確認できる。対象プランではプロフィールメニューから Codex の友人・同僚招待を行える。

### 8.3 Keyboard shortcuts【○ ローカル実装可能】

コマンド名で検索、キー入力で逆引き、キー割り当ての変更、既定値へのリセットができる。

| 操作 | macOS | Windows／Linux |
| --- | --- | --- |
| Settings | Cmd+カンマ | Ctrl+カンマ（Windows）／アプリメニュー（Linux） |
| Activity view | Cmd+Option+U | Ctrl+Alt+U |
| Browser の分割／全体表示 | Cmd+Shift+B | Ctrl+Shift+B |
| 統合ターミナル | Ctrl+バッククォート | Ctrl+バッククォート |
| Appshots | 左右の Command 同時押し | 左右の Alt 同時押し |

実際のキー割り当ては Keyboard shortcuts 設定を優先する。

### 8.4 Notifications【△ 部分依存】

ターン完了通知の表示タイミングを設定する。常に、アプリがバックグラウンドのときだけ、表示しない、を選択できる。アプリが通知権限を要求するか、権限通知・質問通知を個別に表示するかも管理する。

### 8.5 Appearance【○ ローカル実装可能】

- テーマ: Light、Dark、System
- アクセント色、背景色、前景色
- UI フォント、コードフォント
- 半透明サイドバー
- コントラスト
- ポインターカーソルを使用するか
- UI のフォントサイズ
- コードのフォントサイズ
- テーマの Import、Copy theme、カスタムテーマ共有

### 8.6 Browser【△／◎ 混在】

- 内蔵 Browser プラグインのインストール・有効化。
- Chrome などブラウザー拡張機能のセットアップ。
- ブラウザーの権限と、サイト単位の例外。
- Read／Download／Upload それぞれについて、承認が必要、常に許可、ブロックを設定。
- サイト固有の権限を削除して既定値へ戻す。

組織のポリシーで設定項目を制限できる。

### 8.7 Computer Use【◎ OpenAIバックエンド依存】

セットアップ済みアプリ、接続済みブラウザー、Always-allowed apps を確認・管理する。macOS のシステムレベル権限は macOS の Privacy & Security で変更する。

### 8.8 Personalization とコンテキスト【△／◎ 混在】

- 選択したマシン向けの個人指示を AGENTS.md で編集する。
- リポジトリの指示もチャットに適用される場合がある。
- Suggested prompts で、開始・再開時に表示される候補を管理する。
- Memory で、利用可能な場合に Codex の有用な過去コンテキストを引き継ぐかを設定する。
- Archived chats でアーカイブ済みチャットをプロジェクト・日付とともに確認し、Unarchive する。
- 進行中チャットを別ウィンドウへ切り離し、Always on top を有効にする。

### 8.9 Pets（任意のデスクトップ補助）【○ ローカル実装可能】

ペットはエージェント実行そのものではなく、状態を表示する任意のフローティング補助である。組み込み・カスタムのペットを選び、/pet、表示、非表示で操作できる。ペットを表示せずチャットのコントロールだけ残す Mini もある。

### 8.10 ローカル環境【○ ローカル実装可能】

Local environment は ChatGPT デスクトップアプリの Codex 専用設定で、worktree のセットアップ手順とプロジェクト共通アクションを定義する。

- デスクトップアプリの設定ペインから構成する。
- 生成ファイルはプロジェクトの Git リポジトリへチェックインして共有できる。
- プロジェクトルートの .codex に保存される。
- 新しい worktree の開始時にセットアップスクリプトを自動実行する。
- 依存関係のインストール、初回ビルド、開発サーバー起動などに使う。
- macOS、Windows、Linux のプラットフォーム別スクリプトで既定値を上書きできる。

例:

~~~sh
npm install
npm run build
~~~

### 8.11 Cloud environment【◎ OpenAIバックエンド依存】

設定 > Codex Cloud > Environments から、または新しいタスクの作業場所 > Cloud > 環境を選択 > 環境を作成から始める。リポジトリ、セットアップ、依存関係、ツール、アクセス設定、公開状態を確認する。

### 8.12 Windows 固有設定【○ ローカル実装可能】

Windows では、次を選択できる。

- Agent environment: Windows native または Windows Subsystem for Linux。
- Integrated terminal shell: PowerShell など、統合ターミナルで開くシェル。
- Language: アプリ UI の言語、自動検出を含む。

既定は Windows native の Codex エージェントで PowerShell を使う。WSL2 でエージェントを実行する設定変更はアプリ再起動後に有効になる。

## 9. 権限、安全性、実行境界

### 9.1 Sandbox【○ ローカル実装可能】

ローカルコマンドは既定で無制限アクセスを持たず、OS が強制する sandbox で制限される。ネットワークアクセスも既定では無効で、承認ポリシーによって権限昇格や追加アクセスを求めるタイミングを制御する。

OSごとの実装:

- macOS: Seatbelt。追加設定なしで sandbox が動作する。
- Windows native: PowerShell 実行時は Windows Sandbox。
- Windows WSL2: Linux の sandbox 実装。
- Linux／WSL2: bubblewrap が必要。Ubuntu／Debian は sudo apt install bubblewrap、Fedora は sudo dnf install bubblewrap。

### 9.2 Permission profile【○ ローカル実装可能】

ローカルコマンドが読み書きできるファイル範囲と、到達できるネットワーク先を名前付きポリシーで定義する。

- :read-only: ローカルコマンドを読み取り専用にする。
- :workspace: アクティブなワークスペースルートとシステム一時ディレクトリへの書き込みを許可する。
- :danger-full-access: ローカル sandbox の制限を解除する。意図した場合だけ使う。

Permission profile と従来の sandbox_mode／sandbox_workspace_write は同時に設定しない。管理対象の許可プロファイルを使う場合は、古い sandbox 設定との混在に注意する。

### 9.3 承認と Auto-review【◎／○ 混在】

Auto-review は、手動承認待ちを別のレビューワーエージェントの確認へ振り替える機能であり、メインエージェントの sandbox、ネットワーク、ファイルシステム制限を解除しない。

- 対話的な承認がある場合だけ対象になる。
- approval_policy = "never" ではレビュー対象がない。
- Auto-review は「すべての安全確認を無効にする」設定ではない。

### 9.4 無人タスク【△／◎ 混在】

スケジュール済みタスクは無人で実行され、既定の sandbox 設定を使う。ローカルタスクでは端末、アプリ、プロジェクトが実行時にも利用可能である必要がある。Cloud タスクでは、環境と接続先に設定した権限・シークレットの取り扱いを別途確認する。

### 9.5 GUI／画面データの扱い【○／△ 混在】

Computer Use と Appshots は、コードや構造化 API ではなく画面とアクセシブルテキストを扱う。画面収録、アクセシビリティ、対象アプリの表示状態、組織ポリシーがそろわないと動作しない。パスワード、個人情報、秘密鍵、顧客データを映した画面を送信しない。

## 10. OS別の導入と制限

| OS | 導入・実行 | 主な差分 |
| --- | --- | --- |
| macOS | Apple Silicon 向け ChatGPT デスクトップアプリをダウンロード | Seatbelt、Computer Use、Appshots、音声の Screen context、Prevent sleep が利用可能。画面収録／アクセシビリティ権限に注意 |
| Windows | Microsoft Store、または winget install --id 9PLM9XGG6VKS -s msstore | PowerShell＋Windows Sandbox、または WSL2＋Linux sandbox。Git、Node.js、Python、.NET、GitHub CLI を winget で導入可能 |
| Linux | Preview。Ubuntu／Debian は .deb、Fedora は .rpm、Arch はインストールスクリプト | Ubuntu 24.04／26.04 LTS、Debian 13、Fedora 43／44、最新 Arch。x64／ARM64。Computer Use は未対応 |

### 10.1 Linux の対応範囲

公式プレビューで案内されている対象は次のとおり。

- Ubuntu 24.04 LTS、26.04 LTS
- Debian 13
- Fedora 43、44
- 最新の完全更新済み Arch Linux
- 各ディストリビューションで x64 と ARM64

パッケージ更新:

~~~sh
# Ubuntu / Debian
sudo apt update
sudo apt install --only-upgrade chatgpt

# Fedora
sudo dnf upgrade --refresh chatgpt

# Arch
sudo pacman -Syu
~~~

Linux はプレビューのため、その他のディストリビューションが動作しても正式サポートとは限らない。現行ドキュメントでは Computer Use は macOS／Windows のみで、Linux 対応は将来リリースとされている。

### 10.2 Windows と WSL2

- Windows native の Codex は PowerShell でコマンドを実行する。
- WSL2 のプロジェクトは \\wsl$\ から開ける。
- Windows native エージェントで WSL のファイルを扱う場合、Windows 側のドライブにプロジェクトを置き、WSL から /mnt/<drive>/... で参照する方が安定する。
- エージェントを WSL2 で実行する場合は Settings で切り替えてアプリを再起動する。
- WSL1 は Codex 0.115 以降、Linux sandbox が bubblewrap に移行したためサポートされない。
- Windows アプリは %USERPROFILE%\\.codex を使う。WSL 内の CLI は通常 ~/.codex を使うため、認証、設定、キャッシュ、セッション履歴は自動共有されない。
- WSL と Windows で共有したい場合は、CODEX_HOME=/mnt/c/Users/<windows-user>/.codex を設定する方法がある。
- Windows native の Git 機能にはネイティブ Git が必要。GitHub CLI を使う場合は gh auth login を実行する。

## 11. デスクトップだけで使えるもの／使えないもの

### デスクトップアプリが必要

- 内蔵 Browser とコード差分横の localhost プレビュー
- 統合ターミナル
- Local／worktree のローカル環境設定
- Appshots の新規作成
- GUI 用 Computer Use
- デスクトップからの Scheduled 管理
- デスクトップアプリの Codex 用設定、キーボードショートカット、外観、Browser／Computer Use 権限
- 内蔵 Browser の可視化プレビュー、Sites の作成・レビュー・デプロイ管理
- Remote connections のホスト設定、別端末への接続、SSH プロジェクトの追加

### デスクトップでは使えるが、端末を閉じても続けたい場合は Cloud

- 数時間以上のリモート実行
- 端末スリープ中も進める作業
- 公開済み Cloud environment の独立ワークスペースでの作業

### デスクトップでは対象外または制限されるもの

- CLI／IDE 拡張から内蔵 Browser を使うことはできない。
- CLI／IDE 拡張には Scheduled の管理インターフェースがない。
- イベントトリガー型 Scheduled は Web／モバイル向けで、デスクトップでは使えない。
- Linux プレビューでは Computer Use が使えない。
- Appshots の新規作成は CLI ではできない。
- 可視化のインタラクティブプレビューは CLI／IDE では表示されない。
- Sites の単独管理画面は CLI／IDE にはない。
- Worktree、Local、Cloud は同じファイルシステムや認証状態を自動共有しない。

## 12. Ruxex の機能設計へ取り込む際の要点

Ruxex のデスクトップ実装では、Codex 固有の名称をそのまま移植するのではなく、次の操作モデルを抽象化する。

- Workspace: Project、root、最近のタスク、設定をまとめる。
- Execution location: Local、Worktree、Cloud を同じタスクモデルの選択肢として扱う。
- Activity: メッセージ、コマンド、ファイル変更、テスト、承認、レビューを時系列で表示する。
- Review: 変更ファイル、差分、チェック、worktree／branch 情報を同じタスクから開く。
- Tool boundary: Terminal、Browser、Computer Use、MCP、Plugins を別の許可対象として表示する。
- Approval: ファイル、コマンド、ネットワーク、GUI、外部サービスごとに確認可能にする。
- Environment: OS、シェル、sandbox、ネットワーク、認証情報、スケジュール実行条件を明示する。
- Automation: Skills、Hooks、Scheduled tasks を、実行場所と権限付きの再利用可能な単位として扱う。

モデル名、プロバイダー名、内部ランタイム方式は、通常のタスク一覧やレビューの主表示ではなく、必要なときだけ詳細設定へ置く。

## 出典

### 指定ドキュメント（日本語）

- [ChatGPT デスクトップアプリ][docs-app]
- [機能一覧][docs-features]
- [スケジュール済みタスク][docs-automations]
- [長時間にわたる作業][docs-long-running]
- [通知][docs-notifications]
- [Browser][docs-browser]
- [Computer Use][docs-computer-use]
- [ChatGPT Voice][docs-voice]
- [プラグイン][docs-plugins]
- [ウェブ検索][docs-web-search]
- [画像生成][docs-image-generation]
- [画像入力][docs-image-inputs]
- [Appshots][docs-appshots]
- [ブラウザー拡張機能][docs-chrome-extension]
- [ファイルを操作する][docs-artifacts]
- [コードレビュー][docs-code-review]
- [統合ターミナル][docs-terminal]
- [画像生成][docs-image-generation]
- [画像入力][docs-image-inputs]
- [可視化][docs-visualizations]
- [Sites の作成][docs-sites]
- [スキルを構築する][docs-skills]
- [サイトツール][docs-webmcp]
- [フック][docs-hooks]
- [Codex の実行環境][docs-modes]
- [ローカル環境][docs-local-environment]
- [Git worktree][docs-worktrees]
- [Cloud environment][docs-cloud-environments]
- [設定][docs-settings]
- [権限][docs-permissions]
- [サンドボックス][docs-sandboxing]
- [自動レビュー][docs-auto-review]
- [エージェントの承認とセキュリティ][docs-agent-security]
- [Remote connections][official-remote-connections]

### OS別の公式ページ

- [ChatGPT desktop app for Windows][official-windows]
- [ChatGPT desktop app for Linux][official-linux]
- [ChatGPT desktop app][official-app]

[docs-app]: https://www.codex-docs.com/ja/docs/app
[docs-features]: https://www.codex-docs.com/ja/docs/features
[docs-automations]: https://www.codex-docs.com/ja/docs/automations
[docs-long-running]: https://www.codex-docs.com/ja/docs/long-running-work
[docs-notifications]: https://www.codex-docs.com/ja/docs/notifications
[docs-browser]: https://www.codex-docs.com/ja/docs/browser
[docs-computer-use]: https://www.codex-docs.com/ja/docs/computer-use
[docs-voice]: https://www.codex-docs.com/ja/docs/features/voice
[docs-plugins]: https://www.codex-docs.com/ja/docs/plugins
[docs-web-search]: https://www.codex-docs.com/ja/docs/web-search
[docs-image-generation]: https://www.codex-docs.com/ja/docs/image-generation
[docs-image-inputs]: https://www.codex-docs.com/ja/docs/image-inputs
[docs-appshots]: https://www.codex-docs.com/ja/docs/appshots
[docs-chrome-extension]: https://www.codex-docs.com/ja/docs/chrome-extension
[docs-artifacts]: https://www.codex-docs.com/ja/docs/artifacts-viewer
[docs-code-review]: https://www.codex-docs.com/ja/docs/code-review
[docs-terminal]: https://www.codex-docs.com/ja/docs/integrated-terminal
[docs-visualizations]: https://www.codex-docs.com/ja/docs/visualizations
[docs-sites]: https://www.codex-docs.com/en/docs/sites/creating-a-site
[docs-skills]: https://www.codex-docs.com/ja/docs/build-skills
[docs-webmcp]: https://www.codex-docs.com/ja/docs/webmcp
[docs-hooks]: https://www.codex-docs.com/ja/docs/hooks
[docs-modes]: https://www.codex-docs.com/ja/docs/environments/modes
[docs-local-environment]: https://www.codex-docs.com/ja/docs/environments/local-environment
[docs-worktrees]: https://www.codex-docs.com/ja/docs/environments/git-worktrees
[docs-cloud-environments]: https://www.codex-docs.com/ja/docs/environments/cloud-environments
[docs-settings]: https://www.codex-docs.com/ja/docs/reference/settings
[docs-permissions]: https://www.codex-docs.com/ja/docs/permissions
[docs-sandboxing]: https://www.codex-docs.com/ja/docs/sandboxing
[docs-auto-review]: https://www.codex-docs.com/ja/docs/sandboxing/auto-review
[docs-agent-security]: https://www.codex-docs.com/ja/docs/agent-approvals-security
[official-remote-connections]: https://learn.chatgpt.com/docs/remote-connections
[official-windows]: https://learn.chatgpt.com/docs/windows/windows-app
[official-linux]: https://learn.chatgpt.com/docs/linux/linux-app
[official-app]: https://learn.chatgpt.com/docs/app
