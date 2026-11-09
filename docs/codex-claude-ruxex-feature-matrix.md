# Codex／Claude／Ruxex 機能星取り表

調査日: 2026-11-04

## 比較の前提

Codex と Claude は、それぞれのデスクトップアプリについて公式に記載された機能を対象にする。Ruxex は `ruxex-tauri-template` の現在の公開ドキュメントに記載された機能を対象にする。実装予定や設計上の候補は、現在の機能として星を付ける根拠にしない。

星は製品の優劣ではなく、機能が「デスクトップで直接使えるものとして公開資料に記載されているか」を表す。

| 星 | 判定 |
| --- | --- |
| `★★★` | デスクトップ機能として明確に記載されている。 |
| `★★☆` | 一部対応、限定経路、または関連する基盤は確認できるが、完成した同等機能としては限定的。 |
| `★☆☆` | 低レベル基盤・間接的な入口・設計上の関連はあるが、完成したデスクトップ機能の記載はない。 |
| `☆☆☆` | 今回確認した資料の範囲では根拠を確認できない。製品全体に存在しないという意味ではない。 |

## 星取り表

| 機能カテゴリ | Codex Desktop | Claude Desktop | Ruxex Tauri Template |
| --- | --- | --- | --- |
| デスクトップ作業空間・タスク管理 | `★★★` Codex専用ビュー、Projects／Chats、New chat／Quick Chatを公式記載。 [Codex要約](./codex-desktop-features.md) | `★★★` DesktopのChatに加え、Coworkを同じ入口から開始できる。 [Claude要約](./claude-desktop-features.md) | `★★★` ProjectsとThreadsを左右に配置する2領域Workbench、Composer、Activityを現行READMEに記載。 [README](../README.md#workbench-data-boundary) |
| ローカルファイル・リポジトリ | `★★★` ローカルフォルダ／プロジェクトを開いてファイルとコンテキストを利用。 [Codex要約](./codex-desktop-features.md) | `★★★` Desktopからローカルファイルを直接読み書き。 [Claude要約](./claude-desktop-features.md) | `★★☆` Projects、workspace、worktree、ファイル変更の表示は確認できるが、Desktopが任意のローカルファイルを直接読み書きする機能としての記載は限定的。 [README](../README.md#workbench-data-boundary) |
| Projects・コンテキスト・履歴 | `★★★` プロジェクトと長期作業を行き来し、コンテキストを維持。 [Codex要約](./codex-desktop-features.md) | `★★★` ファイル、リンク、指示、メモリを持つProjectsとチャット共有メモリ。 [Claude要約](./claude-desktop-features.md) | `★★★` サーバー管理のProjects、Threads、Goals、Attachments、履歴をUIが扱う。 [README](../README.md#workbench-data-boundary) |
| 長時間・バックグラウンド作業 | `★★★` Cloudでは端末を閉じてもタスク継続。 [Codex要約](./codex-desktop-features.md) | `★★★` Cloud Coworkは端末を閉じても継続し、別サーフェスから再開可能。 [Claude要約](./claude-desktop-features.md) | `★★☆` Schedules、Threadのstart／resume、local／remote接続はあるが、端末をまたぐCloud継続の記載はない。 [README](../README.md#capability-boundary) |
| 複数エージェント・並列作業 | `★★★` 複数エージェントを並列実行し、進捗・結果を1か所で管理。 [Codex要約](./codex-desktop-features.md) | `★★★` Coworkが複雑な作業を分解し、複数の作業ストリームを調整。 [Claude要約](./claude-desktop-features.md) | `★★☆` Activityにagent collaboration、UIにcollaboration-mode inventoryはあるが、並列作業をデスクトップから全面管理する機能としては限定的。 [README](../README.md#workbench-data-boundary) |
| ブラウザ操作 | `★★★` アプリ内ブラウザで閲覧・注釈し、フロントエンド作業に利用。 [Codex要約](./codex-desktop-features.md) | `★★★` 内蔵ブラウザまたはChromeで開く、読む、クリック、入力、フォーム記入。 [Claude要約](./claude-desktop-features.md) | `★★☆` Browser／Computer Useアダプターと検証済みHTTP(S) URLのオープンはあるが、汎用ブラウザ操作の範囲は公式READMEで限定的に記載。 [README](../README.md#capability-boundary) |
| Computer Use・画面操作 | `★★★` 画面を見てクリック・入力し、デスクトップアプリを操作。 [Codex要約](./codex-desktop-features.md) | `★★★` コネクタ、ブラウザに続く経路として画面をクリック・入力・移動。 [Claude要約](./claude-desktop-features.md) | `★★☆` Browser／Computer Useを明示したプロトコル・プラットフォーム境界、動的ツール画像、承認経路を実装。 [README](../README.md#capability-boundary) |
| ファイル・成果物・プレビュー | `★★★` 文書、スプレッドシート、画像などを同じワークスペースで作成・確認。 [Codex要約](./codex-desktop-features.md) | `★★★` 整形済み文書、数式付きスプレッドシート、プレゼンテーションを生成・編集。 [Claude要約](./claude-desktop-features.md) | `★★★` Skill経由でXLSX／DOCX／PPTX／PDFを生成・検査し、Tauri側でページ付きSVGプレビュー、診断、ローカルファイルを開く／コピー保存まで提供。 [README](../README.md#workbench-data-boundary) |
| Plugins・Extensions・Skills・MCP | `★★★` PluginsとSkillsで外部ツール、専門ワークフロー、ドキュメント・デプロイ機能を追加。 [Codex要約](./codex-desktop-features.md) | `★★★` Desktop Extensionsの検証済みディレクトリと、ローカルアプリ・データへの接続。 [Claude要約](./claude-desktop-features.md) | `★★★` MCP status／reload、Skills、Pluginsに加え、App Server経由のGit／ローカルMarketplace、Plugin一覧・導入・更新・削除を実装。Connected appsのOAuth／権限カタログは今後の拡張。 [README](../README.md#capability-boundary) |
| スケジュール | `★★★` スタンドアロンまたは既存チャット内の繰り返しタスク。 [Codex要約](./codex-desktop-features.md) | `★★★` オンデマンドまたは周期指定のScheduled tasks。 [Claude要約](./claude-desktop-features.md) | `★★★` One-shot、daily、weeklyを永続化し、Threadをstart／resumeできる。 [README](../README.md#capability-boundary) |
| 音声・画像・画面コンテキスト | `★★★` Desktop CodexのVoice、画像生成、スクリーンショット・画像を使った作業。 [Codex要約](./codex-desktop-features.md) | `★★★` MacのQuick Entryでスクリーンショット、ウィンドウ、音声Dictation。 [Claude要約](./claude-desktop-features.md) | `★☆☆` Image input、動的ツール画像、`imageView` screenshotはあるが、音声やグローバルQuick Entryの記載はない。 [README](../README.md#capability-boundary) |
| コード・開発ワークフロー | `★★★` コード編集、PRレビュー、ターミナル・ブラウザ・複数ファイルの開発作業。 [Codex要約](./codex-desktop-features.md) | `★★★` DesktopでClaude Code／Coworkを使った開発・ファイル・開発ツール作業。 [Claude要約](./claude-desktop-features.md) | `★★★` provider-neutral App Server、コード／差分レンダリング、Inline review、Git worktree、実行状態を持つ。 [README](../README.md#capability-boundary) |
| 承認・権限・安全制御 | `★★★` Auto-reviewとComposerの承認メニュー、ワークスペース制限。 [Codex要約](./codex-desktop-features.md) | `★★☆` Computer Useの安全注意、コネクタ・ネットワーク権限、タスク削除・制御は記載されるが、同等の承認UIは今回の資料で確認できない。 [Claude要約](./claude-desktop-features.md) | `★★★` Approval requests、server request cards、App Serverを実行・承認の権威にする境界を記載。 [README](../README.md#capability-boundary) |
| Cloud・Remote継続 | `★★★` Codex Cloud、DesktopからのCloud環境作成、Windows Remote Control。 [Codex要約](./codex-desktop-features.md) | `★★★` Coworkセッションがアカウントに紐づき、Desktop／Web／Mobile間で継続。 [Claude要約](./claude-desktop-features.md) | `★★☆` Local／remote App Server接続と、接続中Threadのstart／resumeはあるが、製品管理Cloudの継続機能ではない。 [README](../README.md#capability-boundary) |
| Git worktree | `★★★` Codexアプリの独立worktreeで複数作業を分離。 [Codex要約](./codex-desktop-features.md) | `☆☆☆` 今回採用したClaude Desktop公式資料では、Desktop固有のGit worktree管理を確認できない。 [Claude要約](./claude-desktop-features.md) | `★★★` Repository root、branch、dirty removalを検証するNative Git worktree command。 [README](../README.md#capability-boundary) |
| 通知・Deep Link | `☆☆☆` 今回のCodex Desktop資料では、Ruxexと同じ粒度のNative通知・Deep Linkの記載を確認できない。 [Codex要約](./codex-desktop-features.md) | `☆☆☆` 今回のClaude Desktop資料では、Ruxexと同じ粒度のNative通知・Deep Linkの記載を確認できない。 [Claude要約](./claude-desktop-features.md) | `★★★` 完了Turn、Pending request、切断通知と `ruxex://thread`／`ruxex://project` Deep Link。 [README](../README.md#capability-boundary) |
| OS・提供形態 | `★★★` ChatGPT DesktopはmacOS、Windows、Linuxのダウンロードを案内。機能はプラン・権限・ロールアウトで変動。 [Codex要約](./codex-desktop-features.md) | `★★★` macOS、Windows、Linux（ベータ）を案内し、Computer UseやDictationなどのOS差を明記。 [Claude要約](./claude-desktop-features.md) | `★★☆` Tauri desktop templateとしてLinux／macOSをCI対象にし、platform adapterを持つが、今回の公開資料では全OSの同等提供を確認していない。 [AGENTS](../AGENTS.md#development-and-verification) |

## Ruxex側の読み取り

Ruxex Tauri Templateは、CodexやClaudeの完成された消費者向けデスクトップ機能をそのまま再現する製品ではなく、プロバイダー中立のコーディングエージェントUIとApp Server接続の基盤である。公開根拠が強い領域は、次のような開発作業の制御面である。

- Projects／Threads／Goals／ApprovalsをApp Serverに委ねるタスクワークスペース
- MCP、Skills、Plugins、local／remote App Server接続
- Browser／Computer Useの設定・画像・承認境界
- Schedules、通知、Deep Link、Git worktree
- コード、差分、Inline review、実行イベントを同じ作業面で扱うUI

一方、次の機能は今回確認したRuxexの公開ドキュメントだけでは、CodexやClaudeと同等の完成機能として確認できないため、低い星または根拠なしとした。

- Cloud上で端末をまたいで継続する製品管理型の実行環境
- 音声入力、グローバルなQuick Entry
- Desktop Extensionの検証済みディレクトリ
- 並列エージェントの全面的なオーケストレーション

これは機能が絶対に存在しないという判定ではなく、調査日現在、比較に使った公開根拠が十分でないという判定である。

## 参照した要約・Ruxex資料

- [Codex Desktopの機能要約](./codex-desktop-features.md)
- [Claude Desktopの機能要約](./claude-desktop-features.md)
- [Ruxex Tauri Template README](../README.md)
- [Ruxex Tauri Template AGENTS.md](../AGENTS.md)
