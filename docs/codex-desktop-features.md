# Codex Desktop の機能

調査日: 2026-11-04

## 対象範囲

ここでは、ChatGPT デスクトップアプリ内の Codex と、OpenAI が Codex Desktop の利用文脈で公式に説明している機能を整理する。CLI、IDE 拡張、Web 版だけの機能は含めない。ただし、デスクトップアプリから Cloud や Remote Control などの別実行場所へ接続する機能は、デスクトップ体験の一部として記載する。

利用できる機能は、OS、ChatGPT プラン、ワークスペース権限、段階的ロールアウト、地域、Computer Use などの許可設定によって変わる。

## 機能一覧

| カテゴリ | 機能 | 公式資料に記載された内容 | 主な条件・注意点 | 出典 |
| --- | --- | --- | --- | --- |
| ワークスペース | Codex専用ビュー | ChatGPT デスクトップアプリでは Codex が ChatGPT とは別のビューとして提供され、履歴も分離される。新しいチャットと Quick Chat を開始できる。 | Codex Cloud はWeb／モバイルから利用でき、Desktopで開始したタスクへのRemote accessも別経路として提供される。ローカルDesktopのCodexビューとCloud／Remoteは同一機能ではない。 | [Desktop app][codex-app]、[ChatGPT Work and Codex][codex-work] |
| プロジェクト／コンテキスト | ローカルフォルダ・プロジェクト | フォルダやプロジェクトを開き、選択した場所のファイルとコンテキストを使って作業できる。 | ユーザーがアクセスを許可したファイルが対象。メッセージやタスクコンテキストの保存場所はローカル／クラウドの実行形態で異なる。 | [Desktop app][codex-app] |
| エージェント | 複数エージェントの並列実行 | 複数のエージェントを並列に走らせ、進捗を追い、指示し、結果を1か所で確認できる。 | 利用上限やワークスペース設定の影響を受ける。 | [Codex app introduction][codex-intro] |
| エージェント | 長時間作業 | 数時間・数日・数週間にわたる作業を委任し、複数プロジェクトを移動しながら継続できる。 | Cloud タスクでは端末を閉じても進められるが、ローカル実行ではローカル環境の状態に依存する。 | [Codex app introduction][codex-intro]、[Codex product page][codex-product] |
| 出力 | ファイルの作成・確認 | 文書、スプレッドシート、画像などの実ファイルを同じワークスペースで開いて確認できる。 | ファイル生成の具体的な形式や利用可能なスキルは、接続した機能と環境に依存する。 | [Desktop app][codex-app] |
| Web／Computer Use | ブラウザとデスクトップアプリの操作 | Codex はブラウザ、デスクトップアプリ、プラグインを使える。Computer Use では画面を見て、クリック、入力しながら、ユーザーの作業と並行してアプリを操作できる。 | Computer Use は権限・地域・段階的提供の対象。公式製品資料では初期提供が macOS と説明されている。 | [Codex for (almost) everything][codex-product] |
| Web | アプリ内ブラウザ | アプリ内ブラウザでページを開き、ページ上に直接コメントして、フロントエンドやゲームの変更指示をより正確に伝えられる。 | 公式製品資料は localhost のWebアプリから段階的に拡張する計画として説明している。 | [Codex for (almost) everything][codex-product] |
| 画像 | 画像生成・反復 | GPT Image を使って画像を生成・編集し、スクリーンショットやコードと組み合わせて、UIモック、製品ビジュアル、ゲーム素材などを作れる。 | 利用モデル・上限・権限はアカウントとワークスペースによる。 | [Codex for (almost) everything][codex-product] |
| Skills | 専門ワークフローの追加 | Figmaからデザイン情報を取得、Linearでプロジェクト管理、Cloudflare／Netlify／Render／Vercelへのデプロイ、OpenAI API文書の参照、PDF／スプレッドシート／DOCXの作成などのスキル例が公式に紹介されている。 | スキルは機能拡張の単位であり、接続先の認証・権限・提供状況が必要。 | [Codex app introduction][codex-intro] |
| Plugins | 外部ツールとの接続 | プラグインでツールや専門機能を追加し、作業に必要なコンテキストとアプリへのアクセスを Codex に与えられる。 | インストール・利用可否はプラン、ワークスペース、ロール、アプリ権限に依存する。 | [Using Codex with your ChatGPT plan][codex-plan] |
| スケジュール | 定期タスク | スタンドアロンのスケジュール済みタスク、または既存チャット内の繰り返しタスクを作成できる。 | タスクの提供状況と実行場所はアカウント・環境による。 | [Desktop app][codex-app] |
| 音声 | Voice | デスクトップの Work または Codex で音声会話を開始し、自然に割り込みながら進めたり、タスクの開始・調整を依頼したりできる。 | 対応アカウント、macOS／Windows のデスクトップアプリ、マイクや画面・アクセシビリティ権限が必要になる場合がある。 | [ChatGPT Work and Codex][codex-work] |
| 開発ワークフロー | コードレビュー | Codex はプルリクエストを自動レビューし、指摘を提示して質問に回答できる。 | 自動レビューの対象、GitHub連携、権限、設定によって範囲が変わる。 | [Codex product page][codex-product] |
| 承認・安全 | Auto-review | 通常なら承認待ちになる対象アクションを別のレビュアーが確認し、承認なら継続、拒否なら安全な別案またはユーザー入力に進められる。 | すべての承認プロンプトを置き換えるものではなく、ワークスペース制限も残る。 | [Using Codex with your ChatGPT plan][codex-plan] |
| 実行場所 | Codex Cloud | OpenAI管理のコンピューター上でコーディングタスクを実行し、端末がスリープしても継続できる。デスクトップやWebから環境を作成・公開して利用する。 | Cloud access は Codex Local と別設定。プラン、ロール、ワークスペースの環境権限が必要。 | [ChatGPT Work and Codex][codex-work]、[Codex product page][codex-product] |
| 実行場所 | Remote Control | Windows から他のデバイスを制御する機能が公式ヘルプに記載されている。 | ワークスペース権限とデバイス側の検出・制御設定が必要。 | [Using Codex with your ChatGPT plan][codex-plan] |

## 公式資料から読み取れる位置づけ

Codex Desktop は、単一のコード編集チャットというより、複数エージェント、ローカル／Cloud の実行場所、ファイル・ブラウザ・デスクトップアプリ、レビュー、プラグイン、スケジュールをまとめて扱う作業ハブとして説明されている。特に、アプリ内で進捗を追い、出力を確認し、必要なときに指示や承認を返すことが中心になる。

一方で、公式資料の機能説明には段階的ロールアウトやプラン・ワークスペース依存のものが含まれる。ここでの一覧は「公式資料に記載がある」ことを示すものであり、すべてのアカウントで同時に使えることを保証するものではない。

## 出典

- [ChatGPT desktop app — ChatGPT Learn](https://learn.chatgpt.com/docs/app)
- [ChatGPT Work and Codex — OpenAI Help Center](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- [Using Codex with your ChatGPT plan — OpenAI Help Center](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Codex for (almost) everything — OpenAI](https://openai.com/index/codex-for-almost-everything/)
- [Introducing the Codex app — OpenAI](https://openai.com/index/introducing-the-codex-app/)

[codex-app]: https://learn.chatgpt.com/docs/app
[codex-work]: https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
[codex-plan]: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
[codex-product]: https://openai.com/index/codex-for-almost-everything/
[codex-intro]: https://openai.com/index/introducing-the-codex-app/
