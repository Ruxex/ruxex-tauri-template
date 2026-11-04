# BrowserController境界監査

監査日: 2026-11-05

## 現在App Serverが持つ土台

- `config/read` の `Config` には `browser_use` と `computer_use` の設定があり、`configRequirements/read` の `ConfigRequirements` には `allowBrowserAndComputerUse`、`browserUse`、`computerUse`、`inAppBrowser` がある。
- `BrowserUseRequirements` はWebMCP、履歴参照、Auto Review、永続承認、originごとのポリシーを表現できる。
- `BrowserUseOriginPolicy` はダウンロード、アップロード、Full CDP、永続承認、承認期間を表現できる。
- `thread/start` の `dynamicTools` で、ブラウザ実装などの外部ツールが関数／namespaceの名前・説明・JSON Schemaを登録できる。
- サーバーから `item/tool/call` の `DynamicToolCallParams` (`threadId`, `turnId`, `callId`, `namespace`, `tool`, `arguments`) が届き、既存の汎用 server-request resolve/reject 経路で結果を返せる。
- `DynamicToolCallResponse` はテキスト、画像、音声の入力コンテンツを返せる。既存の会話モデルにはdynamic toolの画像表示経路がある。
- 通常のコマンド／ファイル変更／権限リクエストと同じ承認センター経路は存在するが、ブラウザ操作専用の承認リクエスト型は存在しない。

## ないもの

生成済みの `ClientRequest`／`ServerRequest`／`v2` 型とTauri側を確認した範囲では、次の権威契約は見つからなかった。

- `browser/open`、`browser/snapshot`、`browser/click`、`browser/fill`、`browser/press`、`browser/screenshot`、`browser/download` などの標準操作要求。
- 管理Chromiumの起動、BrowserContextの作成・破棄、ブラウザ／タブ／ページのID管理、sidecarの状態通知。
- Playwright、CDP、WebDriverなどの実行DriverをApp Serverへ登録するライフサイクル契約。
- ブラウザ操作の可逆性、送信・削除・購入・アップロード等を専用に分類する承認要求と結果型。
- ドメイン許可リストやスクリーンショット／DOMの秘密情報マスキングを操作実行時に強制する契約。

`open_browser_window` はTauriからOS既定ブラウザを開くためのURL検証付きコマンドであり、管理ブラウザの操作Driverではない。

## 判定

現行App Serverは「ブラウザDriverを差し込むための汎用dynamic toolと承認・画像イベントの土台」は持つが、BrowserController／管理Chromiumを実行するための権威プロトコルは持たない。したがって、このデスクトップタスクではPlaywright sidecarやローカルブラウザ状態を独自実装しない。

実装を再開する条件は、App Server側で少なくともBrowserControllerの操作・ライフサイクル・承認境界を定義し、Tauriクライアントが生成型または明確なdynamic-tool契約として利用できること。今回のタスクはここで停止し、Plugin接続UXへ進む。
