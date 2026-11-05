# Tauri Agent E2E Verification Loop Design

## Intent

Ruxex DesktopをCodex CLI/Codex Appから起動し、実際のTauri WebViewを操作し、
画面状態と失敗情報を観測しながら、修正と再テストを繰り返せる開発用E2E
ループを追加する。

主な実行環境はUbuntu GNOMEである。開発者のWaylandセッションではXWaylandを
使用し、CIや表示サーバーのない実行ではXvfbを使用する。実アプリのUI操作は
WebdriverIOの外部WebDriver方式を採用し、ログ転送用のTauriプラグインは後段で
debug専用として追加する。

## Goals

- コンパイル済みのTauriアプリをWebdriverIOから起動できるようにする。
- WebView内の要素をアクセシブルな名前やロールで操作できるようにする。
- Wayland + XWaylandの開発環境とXvfbのCI環境で同じE2Eを実行できるようにする。
- 失敗時にスクリーンショット、UI状態、アプリプロセスの出力を保存する。
- Codexが単一のMakefile入口からE2Eを実行し、成果物を読んで修正・再実行できるようにする。
- 既存のRustユニットテストとフロントエンドテストの責務を維持する。
- 後段でフロントエンド/RustログをWebdriverIOへ転送できる構造にする。
- 開発用のWebDriverサーバー、実行API、ログ権限をreleaseビルドへ混入させない。

## Non-goals

- 初回導入でGNOME全体や他アプリを操作するデスクトップ自動化を実装しない。
- OSファイルダイアログ、通知、グローバルショートカット、タイトルバーなどの
  WebView外のUIをWebDriver E2Eの対象にしない。
- WebDriver E2Eで既存のVitest/Testing Libraryテストを置き換えない。
- App Serverへ新しいブラウザ操作プロトコルやBrowserController APIを追加しない。
- releaseビルドへテスト用Tauriプラグインやデバッグ用capabilityを含めない。
- 初回実装で視覚的スナップショット比較を導入しない。スクリーンショットは
  失敗解析と目視確認用の証拠として扱う。

## Anti-goals

- 画面座標を固定したクリックを通常のE2E手段にしない。
- 実ユーザーのRuxexホーム、認証情報、プロバイダ資格情報をE2Eから使用しない。
- WebDriverの成功だけをUIの正しさの根拠にしない。DOM状態と意味のあるアサーションを併用する。
- Wayland上の物理デスクトップをCIの再現条件にしない。基準環境はX11/Xvfbとする。
- E2E失敗時にテストコードから本番用の権限や無制限のコード実行能力を要求しない。

## Approaches

### 1. 外部WebDriver方式（selected）

`@wdio/tauri-service`、`tauri-driver`、LinuxのWebKitWebDriverを使う。Tauriアプリ
内へWebDriver HTTPサーバーを組み込まないため、現在のLinux中心の開発環境に対する
アプリ側の変更を最小化できる。UbuntuではWebKitGTK WebDriverのパッケージ名を
ディストリビューションに合わせて解決し、実行ファイルの存在を事前チェックする。

Wayland開発環境ではE2Eプロセスに`GDK_BACKEND=x11`を設定し、既存のXWayland
ディスプレイを使用する。表示サーバーのないCIでは`xvfb-run`を使用する。

### 2. Embedded WebDriver方式（初回は採用しない）

`tauri-plugin-wdio-webdriver`をTauriプロセス内に組み込む方式である。外部の
`tauri-driver`とWebKitWebDriverを減らせるが、Tauri側のプラグイン、ポート、権限、
debug専用登録を追加する必要がある。将来、複数OSで同じドライバ構成を共有する
必要が生じた場合に再評価する。

### 3. ブラウザモード（補助層として維持）

Viteフロントエンドを通常のブラウザで実行し、Tauriの`invoke`をモックする方式である。
高速なレンダラー/UI回帰テストには有効だが、Rust、WebKitGTK、Tauri capability、
実アプリ起動、ネイティブウィンドウは検証できない。既存Vitest層を補完する用途に
限定し、実Tauri E2Eの代替にはしない。

## Selected Design

### Test layers

責務は次のように分ける。

- Rustユニットテスト: パス、設定、権限、状態変換、Tauri橋渡し。
- Vitest/Testing Library: Reactコンポーネント、hooks、ルーティング、UI状態、
  モックIPC。
- Tauri WebDriver E2E: 実バイナリ、実WebKitGTK、実IPCを含む主要ユーザーフロー。
- デスクトップ操作層: WebView外のOS UI、グローバルショートカット、全デスクトップ画面。

### Execution modes

E2Eは実行環境を明示的に分ける。

- `make e2e`: 開発者のWaylandセッション上でXWaylandを使う。
- `make e2e-headless`: Xvfb上で実行する。
- 両方とも同じWebdriverIO specを使用する。
- テストは最大1ワーカーで実行し、ウィンドウ、ポート、ホームディレクトリの競合を避ける。

アプリは決定的なテスト環境で起動する。初期スモークテストでは既存のdummy providerと
in-process App Serverを使用し、ネットワーク、ログイン、実ユーザーデータに依存しない。
テスト用のランタイムホームは一時ディレクトリに分離し、終了時に後処理する。

### Application binary

WebdriverIOの`appBinaryPath`は、Cargo workspaceの実際の出力位置に合わせる。
現リポジトリでは候補を`target/debug/ruxex-desktop`とし、固定文字列だけに依存せず、
Makefile側で存在と実行権限を検証する。

E2E用バイナリはdebug/test用とする。releaseビルドをE2Eのプラグイン有効化に利用しない。

### Initial E2E surface

最初のスモークテストは、外部サービスや資格情報なしで成立する範囲に限定する。

- アプリが起動し、メインウィンドウが表示される。
- 初期画面の主要見出しまたは主要操作が表示される。
- ホームから主要画面へ遷移できる。
- メッセージ入力へ入力でき、送信操作が適切なUI状態を作る。
- 失敗時に画面のスクリーンショットとUI状態が保存される。

要素選択はアクセシブルなrole/nameを優先し、既存の意味のあるラベルが不足する場合だけ
安定した`data-testid`等を追加する。CSS構造や座標は契約にしない。

### Failure artifacts

E2E実行ごとにGit管理外の成果物ディレクトリを作る。少なくとも次を保存する。

- 失敗時のWebViewスクリーンショット
- WebDriverのspec結果とエラースタック
- 取得可能なUI状態またはページソース
- Tauriアプリプロセスのstdout/stderr
- 実行モード、表示バックエンド、バイナリパス、Git revisionなどの環境情報

成果物はCodexが端末出力とファイル参照から読める、短く検索可能な形式にする。認証情報、
APIキー、実ユーザーのホームデータを成果物へ出力しない。

### Makefile and AGENTS.md contract

実装時に既存のMakefileを入口として、少なくとも次の責務を追加する。

- E2E依存と実行環境のチェック
- debug用Tauriバイナリの生成
- Wayland/XWaylandでのE2E実行
- XvfbでのヘッドレスE2E実行
- 成果物ディレクトリの準備と失敗時保存

`AGENTS.md`には、UI変更時に対象E2Eを実行すること、E2Eは隔離されたdummy/in-process
環境で実行すること、成果物を確認してから修正を続けること、releaseビルドへテスト権限を
追加しないことを記載する。既存のMakefile利用ルールとRust/フロント検証ループは維持する。

## Deferred log plugin design

基本E2EがWayland/XWaylandおよびXvfbで成立した後、`tauri-plugin-wdio`を追加する。
これは外部WebDriver方式でも利用でき、`tauri-plugin-wdio-webdriver`は追加しない。

後段で追加する機能は次のとおり。

- WebViewのfrontend console log転送
- Rust backend stdout log転送
- `browser.tauri.execute()`によるテスト専用観測
- 必要な範囲のTauriコマンドモック

ログプラグインは、Rust依存、Rust登録、フロントエンドimport、Tauri capabilityのすべてを
E2E/debug経路へ限定する。通常の`default` capabilityには`wdio`権限を入れない。Tauriの
capabilityは明示的に通常用だけを選択し、E2E用capabilityをreleaseビルドへ自動包含させない。

ログ転送を有効にした場合でも、ログ取得は補助的な観測手段とし、UIアサーションやRust
ユニットテストの代替にはしない。ログはデフォルトでinfo以上に制限し、必要な調査時だけ
debugへ下げる。

参考:

- [Tauri Tests](https://tauri.app/develop/tests/)
- [Tauri WebDriver](https://v3.tauri.app/develop/tests/webdriver/)
- [WebdriverIO Tauri Platform Support](https://webdriver.io/docs/desktop-testing/tauri/platform-support)
- [WebdriverIO Tauri Configuration](https://webdriver.io/docs/desktop-testing/tauri/configuration)
- [WebdriverIO Tauri Plugin Setup](https://webdriver.io/docs/desktop-testing/tauri/plugin-setup)
- [WebdriverIO Log Forwarding](https://webdriver.io/docs/desktop-testing/tauri/log-forwarding)
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/)

## Constraints

- 対象プロジェクトは`ruxex-tauri-template`とする。
- 現在の未コミット変更を保持し、`src-tauri/src/app_server.rs`、
  `src-tauri/src/desktop.rs`などの別件変更を上書きしない。
- 既存のMakefileを検証入口として使用する。
- RustビルドはリポジトリのMakefile経由で実行する。
- Node.jsが未導入の現環境では、E2E実装前にNode.jsと既存pnpm環境を整える。
- UbuntuのWebKitGTK WebDriverパッケージ名は、公式資料の名称と実際のAPT名が異なる場合が
  あるため、インストール後に実行ファイルを検証する。
- 初期導入では依存関係を増やしすぎず、ログプラグインは後段の変更として分離する。

## Verification expectations

実装完了時には、少なくとも次を確認する。

- Wayland + XWaylandで`make e2e`が成功する。
- Xvfbで`make e2e-headless`が成功する。
- 失敗を意図的に発生させ、スクリーンショットとログ成果物が保存される。
- 既存の`make rust-test`と`make check-tests`が成功する。
- ログプラグイン追加後も、frontend/backendログが成果物またはWDIO出力へ現れる。
- releaseビルドでWebDriverサーバー、`wdio`権限、テスト専用実行APIが有効になっていない。
- `git diff --check`を実行し、別件の変更が保持されている。

## Builder decisions left open

- WebdriverIO依存の正確なバージョンと生成方式は、既存pnpm lockfileとの互換性を確認して決める。
- debug用Tauriバイナリ生成の具体的なMakefileターゲット名は既存レシピに合わせる。
- 最初のE2E specのファイル分割は、実装時の画面境界に合わせる。
- `data-testid`を追加する場合の命名規則は、既存UIのアクセシビリティを確認して最小限に決める。
