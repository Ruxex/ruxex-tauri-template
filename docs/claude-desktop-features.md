# Claude Desktop の機能

調査日: 2026-11-04

## 対象範囲

ここでは、macOS、Windows、Linux（ベータ）の Claude Desktop と、Anthropic の公式 Help Center が Desktop／Cowork の機能として説明している内容を整理する。Web版やモバイル版だけの機能は含めない。ただし、Claude Desktop がローカルファイル、ブラウザ、画面への橋渡しをする Cowork 機能は対象に含める。

## 提供条件

| 項目 | 公式資料の記載 |
| --- | --- |
| OS | macOS、Windows、Linux（ベータ）で Claude Desktop を提供。 |
| 無料プラン | Desktop の Chat は利用可能。 |
| 有料プラン | Claude Code と Claude Cowork は Pro、Max、Ultra、Team、Enterprise などの有料プランが対象。Cowork のWeb／モバイル側はプランとベータ状況により異なる。 |
| Linuxの制限 | Computer Use と Dictation は利用不可。Quick Entry は X11 で動作し、ネイティブ Wayland では GlobalShortcuts portal に依存する。 |
| Computer Use | Cowork と Claude Code のデスクトップアプリでベータ提供。公式記事では Pro、Max、Ultra を対象として説明している。 |

## 機能一覧

| カテゴリ | 機能 | 公式資料に記載された内容 | 主な条件・注意点 | 出典 |
| --- | --- | --- | --- | --- |
| チャット | DesktopでのClaude利用 | Claude の能力をデスクトップに置き、コンピューター上のワークフローに統合できる。 | Chat の利用可否と上限はプランによる。 | [Install Claude Desktop][claude-install] |
| 拡張 | Desktop Extensions | ローカルファイル、カレンダー、メール、メッセージングなどのデスクトップアプリにワンクリックで接続でき、Claude Desktop 内の検証済みディレクトリから拡張を探せる。 | コード署名、秘密情報の暗号化保存、企業ポリシー制御などのセキュリティ機能が説明されている。 | [Install Claude Desktop][claude-install] |
| Cowork | ターミナル不要のエージェント作業 | Claude Code と同じエージェントアーキテクチャを、ターミナルなしの視覚的インターフェースで使い、複雑な複数ステップ作業を委任できる。 | 有料プランが必要。 | [Get started with Claude Cowork][claude-cowork] |
| Cowork | ローカルファイルアクセス | Desktop からローカルファイルを直接読み書きでき、手動アップロード／ダウンロードを減らせる。 | 接続したフォルダやDesktopアプリの状態に依存する。 | [Install Claude Desktop][claude-install]、[Claude Cowork][claude-cowork] |
| Cowork | 長時間作業 | リサーチ統合、ファイル整理、文書生成などを長時間実行でき、会話のタイムアウトやコンテキスト上限に作業を中断されにくい。 | クラウドセッションでは、端末を閉じても作業が継続する。 | [Claude Cowork][claude-cowork] |
| Cowork | 並列サブタスク | 複雑な作業を小さなタスクに分解し、必要に応じて複数の作業ストリームを並列に調整できる。 | 実際の分解・並列化はタスク内容に応じて行われる。 | [Install Claude Desktop][claude-install]、[Claude Cowork][claude-cowork] |
| Cowork | 進捗確認と途中指示 | Claude の計画や進捗を確認し、途中でコース修正や追加指示を返せる。別のサーフェスから同じセッションを開いて監視することもできる。 | クラウドセッションはアカウントに紐づく。 | [Claude Cowork][claude-cowork] |
| Cowork | Projectsと共有メモリ | 関連タスクを、ファイル、リンク、指示、メモリを持つ永続的なワークスペースとして整理できる。チャットとの共有メモリも説明されている。 | タスク開始時点で Memory をオフにできるが、開始後は変更できないとされる。 | [Claude Cowork][claude-cowork] |
| Cowork | 成果物生成 | 動作する数式を含むスプレッドシート、編集可能なプレゼンテーション、整形済み文書などのプロフェッショナルな成果物を生成できる。 | 生成物の形式や連携先はプラン・製品提供状況に依存する。 | [Install Claude Desktop][claude-install]、[Claude Cowork][claude-cowork] |
| Cowork | Markdownのインプレース編集 | Claude が作成した Markdown 文書の変更箇所をハイライトし、「Edit with Claude」でその場に修正を反映できる。 | 対象は公式記事が説明する Markdown 編集フロー。 | [Claude Cowork][claude-cowork] |
| Cowork | スケジュール済みタスク | タスクをオンデマンドまたは任意の周期で保存し、自動実行できる。端末がオンラインでなくてもクラウドで実行される。 | 利用可能性はプラン・段階的提供に依存する。 | [Claude Cowork][claude-cowork] |
| ブラウザ | Browser actions | 内蔵ブラウザでサイトを開き、ページを読み、クリック、入力、フォーム記入を行える。Chromeを優先ブラウザにして、自分のChromeやChromeサイドパネルを使う構成も説明されている。 | ブラウザ設定と接続状態に依存する。 | [Claude Cowork][claude-cowork] |
| Computer Use | 画面操作 | コネクタがない場合、画面を直接操作してクリック、入力、アプリ起動、ブラウザ操作、ファイル操作、開発ツール操作を行える。 | ベータ。公式記事ではまずコネクタ、次にブラウザ、最後に画面操作を優先する順序が示されている。 | [Let Claude use your computer][claude-computer] |
| コネクタ | 既存サービスの利用 | Gmail、Google Drive、Microsoft 365、Slack などのコネクタがあれば、画面操作より高速で信頼しやすい経路として利用する。 | コネクタの接続・権限・組織設定が必要。 | [Let Claude use your computer][claude-computer] |
| Quick Entry | グローバルな呼び出し | Macでは Option キーのダブルタップでどのアプリからでもClaudeを開き、現在の作業を中断せず新しいチャットを始められる。 | macOS限定。Desktopアプリは起動したままバックグラウンドで動作している必要がある。 | [Quick Entry][claude-quick-entry] |
| Quick Entry | 画面コンテキスト | スクリーンショットを取得したり、アプリケーションウィンドウをクリックしてClaudeに渡したりできる。 | 画面収録とアクセシビリティ権限が必要。 | [Quick Entry][claude-quick-entry] |
| Quick Entry | 音声入力 | Caps Lock で音声入力を開始・終了し、リアルタイム文字起こしの内容を確認して送信できる。 | macOS 14以降で音声入力。音声入力のショートカットは無効化・変更可能。LinuxではDictation不可。 | [Quick Entry][claude-quick-entry]、[Install Claude Desktop][claude-install] |

## Coworkの実行場所に関する注記

公式資料には、実行場所について記載の粒度が異なる箇所がある。Claude Cowork の新しい開始ガイドは、セッションとファイルを Claude アカウントに保存し、Anthropic のサーバー上の分離環境でコードとシェルコマンドを実行するクラウドモデルとして説明している。一方、Claude Desktop のインストール記事には「コンピューター上の分離された仮想マシンでコードを実行する」という説明もある。

この整理では、機能の比較に必要な挙動として、Cowork の開始ガイドにある「クラウドで継続し、ローカルファイル・ブラウザ・コンピューターへはDesktopアプリを経由して到達する」という説明を主に採用する。実際の実行場所や提供形態は、利用中のUI、プラン、ロールアウト状況の表示を優先して確認する。

## 公式資料から読み取れる位置づけ

Claude Desktop は、通常のチャットに加えて、Cowork を視覚的なエージェント作業面として統合している。特に、ローカルファイルを扱いながら、ブラウザ、コネクタ、画面操作を使い分け、長時間・並列の作業を成果物まで進める点が中心である。Quick Entry と Desktop Extensions は、Claudeを別ウィンドウのチャットに閉じず、日常のアプリやデータに接続するためのデスクトップ固有機能として説明されている。

## 出典

- [Install Claude Desktop — Claude Help Center](https://support.claude.com/en/articles/10065433-install-claude-desktop)
- [Get started with Claude Cowork — Claude Help Center](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Use quick entry with Claude Desktop on Mac — Claude Help Center](https://support.claude.com/en/articles/12626668-use-quick-entry-with-claude-desktop-on-mac)
- [Let Claude use your computer in Cowork — Claude Help Center](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork)

[claude-install]: https://support.claude.com/en/articles/10065433-install-claude-desktop
[claude-cowork]: https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork
[claude-quick-entry]: https://support.claude.com/en/articles/12626668-use-quick-entry-with-claude-desktop-on-mac
[claude-computer]: https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork
