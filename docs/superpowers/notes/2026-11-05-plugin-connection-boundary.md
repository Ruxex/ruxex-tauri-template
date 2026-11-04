# Plugin接続UXのApp Server境界

監査日: 2026-11-05

## 実装した範囲

- CapabilitiesのMCP一覧で `authStatus: notLoggedIn` に `Connect <server>` を表示する。
- `authStatus: oAuth` には `Re-authenticate <server>` を表示する。
- `bearerToken`、`unknown`、`unsupported` は、それぞれ資格情報の種類／状態を誤解させない説明に変換する。
- Connect／Re-authenticateは既存の `mcpServer/oauth/login` を呼び、返却された `authorizationUrl` が `http` または `https` のときだけ既存のTauri `open_browser_window`へ渡す。
- OAuth完了後の認証情報保存とMCP状態更新はApp Serverの既存Hook・通知・Query invalidationに任せ、デスクトップ側に秘密情報を保存しない。

## App Serverに既にあるもの

- `mcpServer/oauth/login` と `McpServerOauthLoginResponse.authorizationUrl`。
- `McpServerOauthLoginParams.scopes`。これはログイン要求時にクライアントが指定する任意の値であり、サーバーが提供する許可スコープのカタログや同意結果ではない。
- `McpAuthStatus` の `notLoggedIn`、`oAuth`、`bearerToken`、`unknown`、`unsupported`。
- OAuth完了通知とMCPステータス一覧。

## 今回実装しなかったもの

生成済みプロトコルにはMCP専用の `mcpServer/oauth/logout`、接続削除、複数アカウント一覧／選択、認可済みスコープ取得の契約がない。`account/logout` はRuxex Providerアカウントのログアウトであり、MCPサーバー接続の解除APIではない。

そのため、ConnectとRe-authenticateまでは実装したが、Disconnect、複数アカウント管理、権限スコープ表示／編集はApp Server変更なしには安全に実装できない。UI側でローカルにトークンを消したり、スコープ名を推測したりせず、ここでこの部分を停止する。
