# Tauri Capability Completion Design

Date: 2026-11-06

## Intent

Tauri側で未接続になっているApp Serverプロトコルのうち、ユーザー価値が明確な次の4領域を、既存のReact画面・App Server API・TanStack Queryの構成に沿って実装する。

1. `item/permissions/requestApproval` の権限承認UI
2. 個別Pluginのアンインストール
3. Skillsの有効／無効管理
4. MCP Resourceの閲覧

チャット内検索は今回の対象から外す。プロトコルの生成ファイルやApp Server本体は変更せず、既存の型付きリクエストをUIから正しく呼び出すことを目的とする。

## Goals

- 権限要求を保留カードから解決できるようにする。
- Plugin管理画面から、インストール済みPluginを個別にアンインストールできるようにする。
- Skills画面からSkillの有効／無効を切り替えられるようにする。
- MCP Serverが公開しているResourceを一覧し、内容を安全に閲覧できるようにする。
- 各操作でローディング、成功後の再取得、エラー表示を一貫させる。
- 既存のApp Server接続・クエリキャッシュ・承認解決経路を再利用する。

## Non-goals / Anti-goals

- チャット内検索の実装
- プロジェクトのインポート
- `plugin/search`、`plugin/installed`、`plugin/reconcile` の追加実装
- App Serverプロトコル、Rustブリッジ、生成プロトコル型の変更
- MCP Resourceを自動的にモデルのコンテキストへ注入すること
- ResourceのHTML・スクリプトを実行すること
- Skillの本文編集や任意ファイルの編集機能
- Marketplace自体の削除と個別Pluginのアンインストールを同一操作にすること

## Constraints and current state

- `ServerRequestCard` は一般的な `requestApproval` を既に承認カードとして表示しているが、現状のレスポンス生成はCommand ExecutionとFile Changeに限定されている。
- `PermissionsRequestApprovalParams` には要求理由、作業ディレクトリ、Network権限、File System権限が含まれる。
- `PermissionsRequestApprovalResponse` は `permissions` と `scope: "turn" | "session"` を要求する。
- 上流実装では拒否・通信失敗時に空の権限プロファイルとターン限定を返す。許可時は要求された権限プロファイルをGranted形式にして返す。
- Plugin一覧、Skills一覧、MCP Server状態は既存のCapability hooksで取得済みである。
- MCP Server状態の `resources` と `resourceTemplates` は既に `mcpServer/status/list` の詳細レスポンスに含まれるが、現行UIでは表示していない。
- 生成ファイルは直接編集しない。

## Approaches considered

### A. 既存のReact画面とApp Server hooksを拡張する（採用）

既存の型付きAPI、承認解決ブリッジ、TanStack Query、Capabilities/MCP Settings画面を使う。変更範囲が小さく、App Serverを唯一の状態管理元として扱える。

### B. Tauri/Rust側に個別コマンドを追加する

採用しない。App Serverに既に同等のAPIがあり、Rust側に別の状態・エラー処理・権限モデルを持ち込むと二重実装になる。

### C. すべての未使用プロトコルをまとめてCapability Dashboard化する

採用しない。今回必要なユーザー操作を超えて、検索・Reconcile・Resource注入などの仕様判断を同時に増やすためである。

## Detailed design

### 1. Permissions approval

#### User experience

既存の承認カードに権限要求専用の表示を追加する。

- 要求理由があれば表示する。
- Network権限の要求有無と有効化内容を表示する。
- File System権限は、読み取り・書き込みパス、Sandbox entry、glob scan depthを表示する。
- 未知の将来フィールドは無視せず、既存の汎用scope表示に退避して情報を失わない。
- 「今回のみ」と「このセッション」を選択できる。
- 「許可」「拒否」を提供する。
- 長いパスは省略表示し、コピー可能な詳細表示を検討する。パスの値自体は変更しない。

#### Data flow

1. `serverRequestKind` で既にpending approvalへ入るため、イベント分類は変更しない。
2. `approval-model.ts` に `PermissionsRequestApproval` 用の型判定とレスポンス生成を追加する。
3. 許可時は要求された `permissions` をGranted permission profileへ写し、選択したscopeを返す。
4. 拒否時は空のGranted permission profile（`{}`）と `scope: "turn"` を返す。
5. 既存の `resolveServerRequest` 経由で `app_server_resolve_server_request` を呼ぶ。
6. 解決成功後は既存のpending request表示・通知経路に任せ、独自のローカル状態は持たない。

#### Scope policy

初回実装では、許可の粒度を「要求された権限プロファイル全体」とする。Networkの一部だけ、File Systemの一部だけを個別選択するUIは追加しない。これはApp Server側の権限モデルに対してUIが過剰な編集能力を持たないためである。

#### Error handling

- 不正なrequest shapeは既存のpending requestエラー表示に流す。
- レスポンス生成ができない場合は送信せず、ユーザーにエラーを表示する。
- 接続断時は既存のresolve不可状態を利用する。

#### Tests

- 許可／拒否のレスポンスが正しい型・scopeになること。
- Networkのみ、File Systemのみ、両方、空の権限要求を扱えること。
- カード上でscope選択とボタン操作が正しいbridge呼び出しになること。

### 2. Individual Plugin uninstall

#### User experience

CapabilitiesのPlugin一覧で、インストール済みPluginに「アンインストール」を表示する。Marketplace削除とは別操作として扱う。

- 未インストールPluginには既存の「インストール」を表示する。
- インストール済みPluginにはアンインストール操作を表示する。
- 実行前にPlugin名またはPlugin IDを含む確認を表示する。
- 実行中は二重送信を防止する。
- 成功後はPlugin一覧を再取得し、Skill一覧とMCP Server状態も再取得する。
- 失敗時はカード内または操作付近に原因を表示し、一覧を壊さない。

#### API and cache

- `useCapabilityQueries.ts` に `useUninstallPlugin` を追加する。
- 呼び出しは `plugin/uninstall`、paramsは `{ pluginId }` とする。
- 成功時に少なくとも次をinvalidateする。
  - `appServerQueryKeys.plugins`
  - `appServerQueryKeys.skills`
  - `appServerQueryKeys.mcpServers`
- Marketplaceの登録状態は変更しない。Marketplace削除は既存の `marketplace/remove` の責務として残す。

#### Tests

- 正しいPlugin IDで `plugin/uninstall` が呼ばれること。
- 成功時のquery invalidation。
- キャンセル時にAPIが呼ばれないこと。
- pending/error状態が操作UIに反映されること。

### 3. Skills management

#### MVP user experience

CapabilitiesのSkillsタブで、各Skillの現在の `enabled` 状態を表示し、トグルで有効／無効を変更できるようにする。

- Skill名、説明、scope、path、Plugin由来かどうかを既存表示に加えて整理する。
- トグル操作中は対象行だけをpendingにする。
- App Serverの応答 `effectiveEnabled` を成功状態の基準にする。
- 成功後はSkills一覧をinvalidateして、サーバー側の実効状態を再取得する。
- 失敗時は直前の表示を維持し、行単位でエラーを表示する。
- Skillの識別には曖昧な名前ではなく、一覧から取得した `path` を優先して `skills/config/write` に渡す。

#### API and cache

- `skills/config/write` を呼ぶ `useWriteSkillConfig` mutationを追加する。
- paramsは `{ path: skill.path, enabled }` とする。
- 成功後は `appServerQueryKeys.skills` をinvalidateする。Plugin由来Skillの表示変化がある場合に備え、必要ならPlugin queryも同時に再取得する。

#### Follow-up within the same capability

`skills/extraRoots/set` と `hooks/list` は今回のSkills管理の候補だが、Skillトグルの完了を遅らせない。実装時は次の順で扱う。

1. Skill enable/disableを必須MVPとする。
2. 追加Skill rootの登録・削除を、ディレクトリ選択UIを含めて同じ設定領域へ追加する。
3. `hooks/list` は診断用の読み取り専用一覧として追加する。Hook実行・編集は対象外とする。

追加rootとHook一覧は、画面設計とテスト量が大きくなる場合は後続コミットへ分離できるが、プロトコル境界は最初からこの切り分けで設計する。

#### Tests

- path指定で `skills/config/write` が呼ばれること。
- `effectiveEnabled` を反映すること。
- 同一画面で複数行を操作してもpending状態が混線しないこと。
- 失敗時に一覧の表示状態を誤って反転しないこと。

### 4. MCP Resource viewer

#### User experience

MCP Servers設定画面の各Server行を展開すると、そのServerが公開するResourceを閲覧できるようにする。

- `mcpServer/status/list` で取得済みの `resources` を一覧する。
- Resource名、title、description、URI、MIME type、サイズを表示する。
- Resourceを選択すると `mcpServer/resource/read` を呼び、内容を詳細パネルまたはダイアログに表示する。
- text内容はプレーンテキストとして表示し、JSONらしければ整形表示を提供する。
- blob内容は実行・自動展開せず、MIME type、サイズ、取得済みであることを表示する。ダウンロード導線は別途必要な場合のみ追加する。
- Resourceがない場合、読み込み中、読み込み失敗をそれぞれ明示する。
- `resourceTemplates` は「動的Resourceのテンプレート」として表示できるが、URIパラメータの入力仕様が必要なため、初回実装では直接read対象にしない。

#### API and cache

- `appServerQueryKeys` に `(server, uri)` 単位のResource query keyを追加する。
- `useMcpResource(server, uri)` を追加し、選択されたResourceだけを有効化して `mcpServer/resource/read` を呼ぶ。
- Settings画面から読む場合は `threadId` を省略する。チャット内のResource viewerへ拡張する場合だけ、現在のthread IDを明示的に渡す。
- query cacheに保持するが、Server一覧の再取得とResource内容の再取得を混同しない。

#### Safety boundary

- Resource textをHTMLとして描画しない。
- URIやMIME typeを信頼して外部URLを自動で開かない。
- blobを実行可能ファイルとして扱わない。
- この機能は閲覧専用であり、モデルへのコンテキスト注入やファイル保存は行わない。

#### Tests

- ServerのResource一覧が表示されること。
- URI選択で正しい `server` と `uri` が送信されること。
- text/blobの両形式を安全に表示すること。
- Resource readのエラー・空結果・再選択を扱えること。

## Implementation order

実装時は次の順に進める。各ステップで型チェック・関連テストを通してから次へ進む。

1. Permissions approvalのレスポンスモデル、scope選択、承認カード、テスト
2. Plugin uninstall hook、確認UI、query invalidation、テスト
3. Skills toggle hook、行UI、実効状態反映、テスト
4. MCP Resource query、Resource一覧／詳細表示、text/blob安全境界、テスト
5. Skills extra rootsとHook一覧を、MVPの複雑度を確認した上で追加
6. 既存のCapability画面間で操作後の再取得とエラー表示を統一

## Expected files to change

- `src/components/approvals/approval-model.ts`
- `src/components/approvals/ServerRequestCard.tsx`
- 承認モデル・承認カードのテスト
- `src/app-server/hooks/useCapabilityQueries.ts`
- App Server query key定義とhookテスト
- `src/pages/CapabilitiesPage.tsx`
- `src/pages/McpServersPage.tsx`
- 各ページの既存テストまたは追加テスト

生成された `src/protocol/generated/**` は変更しない。

## Verification plan

- `make check-tests`
- `make rust-test`（Rust側変更がないことも含めて既存ブリッジを確認）
- `make verify`
- `git diff --check`
- 手動確認：権限要求、Pluginアンインストール、Skill切替、MCP Resourceのtext/blob表示

## Acceptance criteria

- 4領域すべてが既存App Server接続経由で動作し、未接続のボタンが残らない。
- 拒否・キャンセル・通信エラーで危険な権限付与や誤ったUI状態を作らない。
- Pluginアンインストール後に関連するPlugin/Skill/MCP表示が古いまま残らない。
- Skill切替後にApp Serverの実効状態とUI表示が一致する。
- MCP Resourceは安全なプレーンテキスト／メタデータ表示に限定され、任意コンテンツを実行しない。
- 今回除外したチャット内検索、プロジェクトインポート、Plugin検索等が混入しない。
