# 実プロバイダ接続スモークテスト

このドキュメントは、Ruxexの実プロバイダと実LLMがTauriアプリから利用できる状態かを確認するための、手動・逐次操作型のスモークテスト手順です。

テスト対象とコマンドの実行場所は`ruxex-tauri-template`です。Tauriアプリのビルド、起動、MCP fixtureのビルド、WDIO操作はすべてこのディレクトリで行います。実Providerのランタイムパッケージは既存のステージング手順で用意しますが、MCP fixtureはこのリポジトリに含まれています。

定型的なE2Eテストではなく、WebdriverIO v10の永続セッションを使って、アプリを観測しながら次の操作を選べることを確認します。実プロバイダと実LLMを使うため、API利用料、レート制限、モデルの非決定性が発生します。回答文の品質や完全一致ではなく、リクエスト、ストリーミング、tool call、承認、結果表示が最後まで成立することを主な判定対象にします。

## 対象範囲

次の境界を確認します。P0は実行ごとの最小スモーク、P1はリリース前または接続処理の変更時に行う拡張スモークです。

### P0: 実行ごとの最小スモーク

1. Tauriアプリ、App Server、プロバイダの起動
2. プロバイダ認証とモデルカタログ取得
3. 新規チャット作成と単純な回答
4. ストリーミング中のUI状態
5. ローカルツール呼び出し、承認、実行結果
6. ローカルツールの承認拒否
7. MCPサーバーの検出とMCP tool呼び出し
8. 複数ターンの履歴保持

### P1: リリース前・変更時の拡張スモーク

1. MCP toolの進捗、エラー、タイムアウト
2. Providerのタイムアウト、レート制限、部分応答後の失敗
3. Stop／キャンセル後のturnとtoolの状態
4. MCPまたはApp Serverの再接続
5. アプリ再起動後の履歴復元
6. API key、Authorization、MCP tokenの画面・ログへの漏洩がないこと
7. 実行時間、使用トークン、発生コストの記録
8. Streamable HTTP MCPの接続と再接続

回答文の完全一致は判定基準にしません。turnの状態、Activity、承認request、実行結果、エラー表示、ログ上のID対応を確認します。

## 安全上の前提

- 実プロバイダのAPI keyをリポジトリへ保存しない。
- 通常のユーザーホームを使う。Cloudflare版は通常ホーム配下の`~/.ruxex_desktop_cloudflare`をプロバイダ専用ホームとして使うため、`mktemp`で`HOME`、`RUXEX_HOME`、`XDG_*`を上書きしない。
- ツール確認では、`printf`、`pwd`、`cat /etc/hostname`など副作用のないコマンドだけを使う。RP-06の`cat /etc/hostname`はworkspace外の読み取り挙動を確認するための固定参照であり、別のパスへ変更しない。
- 実行前に、選択中のモデル、権限モード、対象ホーム、利用料が発生することを確認する。
- 実行ごとにテスト対象のProvider、モデル、fixtureのrevision、開始時刻を記録する。
- スモークテスト中に作成したスレッドや資格情報はCloudflare専用ホームに保持し、通常のRuxexホーム（`~/.ruxex`）へ混ぜない。
- テスト終了時はWDIOセッション、`tauri-driver`、Tauriアプリを明示的に終了する。

## MCP fixture

MCPのP0では、GitHubやSlackなどの実サービスではなく、テスト専用のMCPサーバーを接続します。これはApp ServerやLLMのモックではなく、実際のMCPプロトコルで動く小さなサーバーです。LLMとProviderは実物のままにし、外部toolの応答だけを決定的にします。

TauriTemplateには、stdioで`echo` toolを提供する`ruxex-mcp-fixture`と、Streamable HTTPで同じfixtureを提供する`ruxex-mcp-http-fixture`が含まれています。これらをP0/P1の標準fixtureとして使います。

```sh
make mcp-fixture-build
export MCP_FIXTURE_BIN="$PWD/target/debug/ruxex-mcp-fixture"
test -x "$MCP_FIXTURE_BIN"
```

`make mcp-fixture-build`はTauriTemplateの`src-tauri`ワークスペースからfixtureバイナリをビルドします。TauriTemplate本体は、後述の通常Cloudflare debugビルドと、この文書の実Provider用WDIOコマンドで確認します。

MCP fixture単体のstdio疎通は、実LLMを使わずに次で確認できます。

```sh
make mcp-fixture-test
```

テスト用ホームのユーザー設定には、絶対パスで次のサーバーを登録します。`<MCP_FIXTURE_BIN>`は実際の値に置き換えます。

```toml
[mcp_servers.ruxex_smoke]
command = "<MCP_FIXTURE_BIN>"
args = []
enabled = true
required = false
```

このfixtureの`echo` toolに固定メッセージを渡し、MCP server status、tool catalog、tool call、result、最終回答の順に確認します。テスト用MCPはファイル変更、ネットワークアクセス、資格情報を必要としません。

P1でHTTP transportも確認する場合は、TauriTemplateに含まれる`ruxex-mcp-http-fixture`をlocalhostで起動します。

```sh
MCP_STREAMABLE_HTTP_BIND_ADDR=127.0.0.1:3920 \
  ./target/debug/ruxex-mcp-http-fixture
```

接続先は`http://127.0.0.1:3920/mcp`です。HTTP fixtureは、通常のtool呼び出しに加えて、接続断、再接続、Bearer tokenの受け渡しを検証するときだけ使います。実外部MCPを使う場合は、専用のGitHubテストリポジトリなどread-onlyの環境に限定し、P0の合否には含めません。

## 起動

### ビルド

`make local-cloudflare`と同じCloudflare provider・daemon構成で、E2E専用featureを含まない通常のdebugバイナリを生成する場合は、次を実行します。

```sh
RUXEX_PROVIDER=cloudflare \
RUXEX_APP_SERVER_MODE=daemon \
pnpm tauri build --debug --no-bundle
```

生成されるバイナリは`target/debug/ruxex-desktop`です。`--features e2e`や`src-tauri/tauri.e2e.conf.json`は使いません。このバイナリはdebug用途なので、診断用プラグインを使う場合でも、リリース用のTauri capabilityへ権限を追加してはいけません。

### 通常ホームの準備

RP-02以降へログイン状態を引き継ぐため、通常のユーザーホームをそのまま使います。Cloudflare版は通常ホーム配下の`~/.ruxex_desktop_cloudflare`をプロバイダ専用ホームとして使うため、通常の`~/.ruxex`とは分離されます。スモークテストのたびに`mktemp`で`HOME`や`XDG_*`を差し替えないでください。

Cloudflareの場合は、通常どおり`CLOUDFLARE_ACCOUNT_ID`を環境変数または`.env.local`から提供します。`CLOUDFLARE_MODEL`を設定すると、モデル一覧がその1モデルに絞られ、チャット送信時もそのモデルが強制されます。API keyはテスト中にUIから入力し、ファイルへ記録しません。

`.env.local`を使う場合は、`tauri-driver`を起動するシェルとWDIOセッションを開くシェルのそれぞれで、次を実行して値をexportします。

```sh
set -a
. ./.env.local
set +a
```

### `tauri-driver`と永続WDIOセッション

シェル1で`tauri-driver`を起動します。

```sh
RUXEX_PROVIDER=cloudflare \
RUXEX_APP_SERVER_MODE=daemon \
tauri-driver --port 4444
```

WebKitWebDriverがPATHにない場合は、既存の`--native-driver`指定を使います。

シェル2でWDIOセッションを1回だけ開きます。

```sh
RUXEX_PROVIDER=cloudflare \
RUXEX_APP_SERVER_MODE=daemon \
RUXEX_SESSION_APP_BINARY=target/debug/ruxex-desktop \
pnpm exec wdio session open ./wdio.tauri.conf.mjs 0 \
  --idle-timeout 0 \
  --session ruxex-provider-smoke
```

以後の操作は、同じセッションに対する独立したコマンドとして実行します。

```sh
pnpm exec wdio session status --session ruxex-provider-smoke
pnpm exec wdio session snapshot --interactive --session ruxex-provider-smoke
pnpm exec wdio session diff --session ruxex-provider-smoke
pnpm exec wdio session screenshot --session ruxex-provider-smoke
pnpm exec wdio session info --session ruxex-provider-smoke
```

snapshotのrefはUI状態が変わると無効になる可能性があるため、操作前に最新snapshotを取得します。

## スモークテストシナリオ

### RP-01: 起動・App Server・モデルカタログ

目的: 実プロバイダを選択したTauriアプリが起動し、App Serverとモデルカタログまで到達できることを確認する。

操作:

1. セッションを開く。
2. `status`とinteractive snapshotを取得する。
3. SettingsのRuntimeまたはAccount画面を開く。
4. Provider、Auth、Connection、Modelsの表示を確認する。

合格条件:

- TauriプロセスとWDIOセッションが生存している。
- App Serverが`Connected`になっている。
- Providerが対象の実プロバイダになっている。
- Auth状態が認証前または認証済みとして整合している。
- モデル数が0件ではない、または認証前として明確な状態になっている。
- 起動エラーがある場合、画面にエラーが表示される。

### RP-02: ログインとモデル選択

目的: プロバイダ固有の認証フローとモデル選択を確認する。

操作:

1. 未認証ならLogin画面を開く。
2. `API key`へ資格情報を入力する。
3. `Log in`を押す。
4. Account画面またはRuntime画面へ移動する。
5. `Model and effort`からモデル一覧を開く。
6. 実際にツールを使うモデルを1つ選択する。

合格条件:

- ログイン完了後にAccount/Authが認証済みになる。
- モデル一覧取得が成功する。
- 利用できないモデルが誤って選択可能になっていない。
- モデル選択後、composerに選択モデルが表示される。
- API keyが画面の通常テキストやログへ露出しない。

### RP-03: 単純な新規チャット

目的: 実LLMへの最小リクエストと回答表示を確認する。

入力例:

```text
2+2の答えだけを短く返してください。
```

操作:

1. `Message`へ入力する。
2. `Send`を押す。
3. 送信直後、実行中、完了後にsnapshotを取得する。

合格条件:

- 入力前はSendが無効で、入力後に有効になる。
- ユーザーメッセージが1件だけ追加される。
- チャットURLへ遷移する。
- 実行中にWorking状態が表示される。
- ストリーミング中にassistantの内容が更新される。
- 完了後に空のassistantメッセージが表示されない。
- 最終assistantメッセージが空白ではない。
- 完了後にcomposerが再び入力可能になる。

### RP-04: ストリーミングと空assistantメッセージ

目的: 実LLMのレスポンスイベント列がUIへ反映される際、空のassistantメッセージや重複した`...`が表示されないことを確認する。

入力例:

```text
Ruxexの目的を、短い箇条書きで説明してください。
```

確認点:

- ストリーミング開始時に空のassistantバブルが表示されない。
- Workingインジケーターは必要な場合だけ表示される。
- Activityとassistantメッセージが重複しない。
- 最終回答到着後に空のassistantメッセージが残らない。
- 履歴を再読み込みしても同じ表示になる。

### RP-05: ローカルツール呼び出しとAllow

目的: LLMのtool call、承認、コマンド実行、結果表示を確認する。

composerの権限モードを`Ask for approval`にします。

入力例:

```text
printf 'ruxex-tool-check\\n' を実行して、標準出力を報告してください。
```

合格条件:

- tool callがActivityとして表示される。
- Approvalカードが表示される。
- Allowするまでコマンドが実行されない。
- Allow後にcommand executionと結果が表示される。
- 結果に`ruxex-tool-check`が含まれる。
- 最終assistantメッセージが表示される。
- 同一コマンドが意図せず二重実行されていない。

### RP-06: ローカルツール呼び出しとworkspace外参照

目的: workspace外の読み取りが、現在のsandboxと承認ポリシーでどのように扱われるかを確認する。

入力例:

```text
cat /etc/hostname を実行して、内容を返してください。通常のローカルコマンドとして実行し、参照先はこのパスに固定してください。
```

`workspace-write`では読み取りだけのworkspace外参照が自動許可される場合があります。その場合はApprovalカードが出ないこと自体を失敗とはせず、command executionの結果とログ上の承認request有無を記録します。Approvalカードが表示された場合は、AllowではなくDenyまたはRejectを押し、拒否後にコマンドが成功状態にならないことを確認します。

合格条件:

- command executionがworkspace外の参照として記録される。
- Approvalカードが出た場合、拒否したrequestに対応するcommand executionが成功状態にならない。
- Approvalカードが出た場合、拒否結果がUIに表示され、拒否したrequestが自動的にAllowへ変換されない。
- Approvalカードが出なかった場合、承認requestなしで自動許可されたことをログで確認する。
- モデルが再試行した場合、別のrequestとして識別でき、再試行の実行可否が現在の権限ポリシーと一致している。

モデルが拒否後に別の権限で同じコマンドを再要求する場合は、最初の拒否と再試行を別requestとしてログで確認します。プロダクト仕様として再試行も禁止する場合は、その再試行も拒否されることを合格条件に加えます。

### RP-07: MCPサーバー検出とMCP tool呼び出し (P0)

目的: 実プロバイダ経由でLLMがMCP toolを発見・呼び出し、MCPの結果をassistantの回答へ反映できることを確認する。

前提として、[MCP fixture](#mcp-fixture)の`ruxex-mcp-fixture`を`ruxex_smoke`という名前で登録します。P0ではstdio fixtureを使い、外部API、資格情報、ファイル変更に依存させません。Streamable HTTPはP1で別途確認します。

操作:

1. CapabilitiesのMCP画面を開く。
2. `Reload MCP`を押す。
3. 対象MCPサーバーのruntime status、認証状態、tool数を確認する。
4. `toolsError`が表示されていないことを確認する。
5. LLMに対象MCP toolを明示的に呼び出すよう依頼する。

入力例:

```text
MCPサーバー「ruxex_smoke」の`echo` toolを使い、メッセージ「ruxex-mcp-smoke-v1」をそのまま返してください。通常のローカルコマンドではなく、必ずMCP toolを使ってください。
```

合格条件:

- MCP画面で対象サーバーが`connected`、`running`、または実装に対応する正常状態になる。
- MCP tool一覧に`echo`が表示される。
- LLMのtool callがローカルコマンド実行ではなくMCP tool callとして記録される。
- MCP toolのresultが表示される。
- tool引数に`ruxex-mcp-smoke-v1`が含まれ、最終assistantメッセージもその値を参照している。
- MCP toolの呼び出し、結果、最終回答が同じ`threadId`と`turnId`に紐付く。
- 実行後に同じMCP toolが意図せず二重実行されていない。

このシナリオは、実プロバイダが通常の回答を返せることとは別に、Agentとして外部能力を呼び出せることを検証します。MCP toolを呼ばなかった場合は、UI不具合と決めつけず、選択モデルがtool利用に対応しているか、promptとtool catalogが正しく渡っているか、Providerへのtool定義が含まれているかをログで確認します。モデルの気まぐれだけで合否を決めないため、`mcpToolCall`イベントとtool引数を主判定にします。

### RP-08: 複数ターンと履歴

目的: 同一スレッドのコンテキストと表示順を確認する。

1ターン目:

```text
合言葉を「ruxex-check」にしてください。回答は短くしてください。
```

2ターン目:

```text
先ほどの合言葉だけを返してください。
```

合格条件:

- 2ターン目が同じスレッドに追加される。
- 2ターン目が1ターン目の内容を参照できる。
- ユーザー、assistant、Activityの順序が崩れない。
- 空のassistantメッセージが履歴に残らない。
- turn間のActivityが混ざらない。

### RP-09: 逐次操作とセッション維持 (P1)

目的: Codexが観測結果を確認してから、別のコマンドで次の操作を実行できることを確認する。

シェルA:

```sh
pnpm exec wdio session snapshot --interactive --session ruxex-provider-smoke
```

シェルB:

```sh
pnpm exec wdio session fill <message-ref> "現在の状態を一言で説明してください" --session ruxex-provider-smoke
```

シェルC:

```sh
pnpm exec wdio session click <send-ref> --session ruxex-provider-smoke
```

その後、別のコマンドで次を実行します。

```sh
pnpm exec wdio session snapshot --interactive --session ruxex-provider-smoke
pnpm exec wdio session diff --session ruxex-provider-smoke
```

合格条件:

- 最初のWDIOコマンド終了後もTauriプロセスが生存する。
- 別シェルから同じセッションへ接続できる。
- 前の入力結果が次のsnapshotへ反映される。
- アプリを再起動せずに観測、入力、送信、再観測を繰り返せる。

### RP-10: 再接続と履歴復元 (P1)

目的: 実プロバイダまたはApp Serverに一時的な失敗が起きた後の復旧を確認する。

確認項目:

- 失敗時にUIがハングしない。
- provider errorやturn errorが表示される。
- `Reconnect`後にApp ServerがConnectedへ戻る。
- 既存スレッドが消えない。
- アプリを終了して同じ通常ホームのCloudflare専用ホームで再起動した後、スレッド履歴が表示される。
- Activity、tool結果、最終assistantメッセージが復元される。

このシナリオでは、通常利用中の設定を壊すために資格情報やホームを直接変更しません。Cloudflare専用ホームと、テスト用の制御可能な接続断だけを使います。

### RP-11: Providerエラー、レート制限、キャンセル (P1)

目的: 実LLMの応答が成功しない場合でも、UIがハングせず、turnとtoolの状態を正しく終端できることを確認する。

実Providerが提供するテスト用エラー注入機能がある場合はそれを使います。ない場合は、専用の短いプロンプトや接続断など、再現可能な条件だけを使います。

確認項目:

- Providerのタイムアウトまたはレート制限が、成功扱いにならずエラーとして表示される。
- 部分的なassistant出力があった場合も、turnが終了状態になる。
- エラー後にcomposerが再び操作可能になる。
- Stop／キャンセル後に、後続のassistant出力やtool実行が勝手に追加されない。
- キャンセルしたMCP toolまたはローカルtoolが、UI上で成功扱いにならない。
- retry hintが表示される場合、実際の待機時間と内容がログ上で確認できる。

## ログ観測

シナリオごとに必要な範囲だけログを確認します。常に全ログを取得する必要はありません。

| シナリオ | 主な観測対象 |
| --- | --- |
| RP-01 | App Server起動、provider descriptor、接続状態 |
| RP-02 | login start/completed、account、model catalog |
| RP-03/04 | request start、stream delta、turn completed |
| RP-05/06 | tool call、approval request/response、execution result |
| RP-07 | MCP server status、tool catalog、MCP tool call/progress/result |
| RP-08 | thread、turn、itemの順序と同期 |
| RP-10 | provider error、再接続、resynchronization、history load |
| RP-11 | timeout、rate limit、cancel、partial response、tool cancellation |

ログ上で少なくとも次のIDを関連付けます。

- `threadId`
- `turnId`
- `itemId`
- `requestId`

ログにはAPI key、Authorizationヘッダー、不要な資格情報を出力しません。画面のレイアウトや表示崩れを調べる場合だけ、WDIOのscreenshotを追加で取得します。

## 合否判定

実プロバイダ実装のP0スモークテストは、次をすべて満たせば合格とします。

- [ ] RP-01: App Server接続とモデル一覧取得が成功した
- [ ] RP-02: ログインとモデル選択が成功した
- [ ] RP-03: 単純な新規チャットが完了した
- [ ] RP-04: ストリーミング中の空assistantメッセージが表示されなかった
- [ ] RP-05: Allowした安全なローカルツールが実行され、結果が表示された
- [ ] RP-06: Denyしたローカルツールrequestがそのまま実行されなかった
- [ ] RP-07: `ruxex_smoke/echo`が検出され、LLMから呼び出され、`ruxex-mcp-smoke-v1`が表示された
- [ ] RP-08: 複数ターンの履歴が保持された

P1は、リリース前またはプロバイダ/App Server/MCPの接続処理を変更したときに実施します。

- [ ] RP-09: アプリとWDIOセッションを維持した逐次操作ができた
- [ ] RP-10: 再接続後に既存スレッドと履歴を復元できた
- [ ] RP-11: Providerエラー、レート制限、キャンセルが成功扱いにならなかった
- [ ] Streamable HTTP MCPの接続、tool call、再接続が成功した

## 終了

```sh
pnpm exec wdio session close --session ruxex-provider-smoke
```

その後、`tauri-driver`を起動したシェルでプロセスを停止します。広い条件の`pkill`などは使わず、今回のテストで起動したプロセスだけを停止します。

## 既存テストとの役割分担

- Vitest: UI表示条件、状態遷移、エラー表示などの決定的な回帰テスト
- dummy provider: 実Tauriの起動、アクセシブルな操作、App Server結線の決定的な確認
- 本ドキュメント: 実プロバイダ、実LLM、ストリーミング、ローカルツール、決定的なMCP fixture、承認を含む探索的スモークテスト
- 永続WDIOセッション: Codexが観測と操作を交互に行う開発ループ

実プロバイダの応答文やツール選択はモデル依存のため、回答文の完全一致や一回のtool未選択だけで失敗と判定しません。再現性の高い不具合だけを、別途dummy providerまたは専用fixtureの回帰テストとして残します。実外部MCPへの接続は、専用アカウントとread-only権限を使う別ジョブとして扱い、P0の合否から分離します。
