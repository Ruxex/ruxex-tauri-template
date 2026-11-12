# Responsive Chat Columns Design

## Intent

チャット画面の利用可能幅に応じて、チャット・ミニマップ・スレッドサマリを最も情報量の多い組み合わせで表示する。viewport幅ではなく、左右ペインを除いたチャット領域の実効幅を基準にすることで、ペインの開閉やアニメーション中も余白と表示状態を一貫させる。

## Goals

- 狭い幅ではチャット列だけを表示する。
- もう少し幅があれば、ミニマップ＋チャット列を表示する。
- スレッドサマリが成立する幅では、ミニマップより優先してチャット＋スレッドサマリを表示する。
- さらに幅が広がれば、ミニマップ＋チャット＋スレッドサマリを表示する。
- チャット列は最大 `53rem` 前後で、それ以上は広がらない。
- スレッドサマリの最大幅は `24rem` 前後とし、コンポーネント自身には `min-width` を設定しない。
- 非表示列は余白を残さず、表示領域から除外する。
- チャット領域のスクロール境界とコンポジション固定を維持する。

## Non-goals

- 右ペインの機能や内容を変更しない。
- チャット列のコンテンツ構造やメッセージ描画を変更しない。
- スレッドサマリの各セクションの内容を変更しない。

## Visual contract

狭い順の表示状態は次のとおり。状態は「画面全体の幅」ではなく「チャット領域の幅」で選ぶ。

| State | 表示構成 | 選択理由 |
| --- | --- | --- |
| Chat only | チャット | 最小幅でも会話を利用可能にする |
| Minimap + chat | ミニマップ（1fr）＋チャット（最大幅）＋空き（1fr） | 左右を釣り合わせてチャットを中央に置く |
| Chat + summary | チャット＋スレッドサマリ | スレッドサマリをミニマップより優先する |
| All columns | ミニマップ（1fr）＋チャット（最大幅）＋スレッドサマリ（1fr） | 十分な幅では左右を可変幅にして最大情報量にする |

状態3では、ミニマップを残して幅不足にするのではなく、ミニマップを除いてスレッドサマリを表示する。状態4でミニマップを再表示する。

## Architecture

### Width source

`AppLayout` のチャットコンテンツ領域を名前付き inline-size container とし、`ConversationWorkspace` はその container query を使う。これにより、左ペイン・右ペイン・ウィンドウリサイズで実効幅が変わっても、同じ表示規則が適用される。

### Layout ownership

- `AppLayout`: チャット領域を container として提供する。スクロール境界とヘッダの責務は変更しない。
- `ConversationWorkspace`: 4つの表示状態をTailwindのcontainer-query variantで表現し、3つの意味上の列を配置する。
- `ConversationMinimap`: 列の表示状態を決めず、親から与えられた列幅に収まる。
- `ThreadSummaryPanel`: 列の表示状態を決めず、コンポーネント自身に最小幅を持たせない。

### Styling rules

レイアウトの新規指定はTailwindのユーティリティを優先する。viewport breakpointに依存する `min-[...]` のチャット列指定と、同じ責務を持つcustom CSSは削除する。`min-w-0` と `overflow-hidden` は、列が非表示状態になったときの内容のはみ出し防止にだけ使う。

## Approaches considered

1. **Container queryによるTailwind状態切り替え（採用）**
   - 実効幅を直接入力にでき、React stateやリサイズイベントを増やさない。
   - 左右ペインのアニメーションにも自然に追従する。
2. **ResizeObserver + React state**
   - 状態の単体テストはしやすいが、リサイズ中の再レンダリングと境界付近のちらつきが増える。
3. **viewport breakpoint（現状）**
   - 左右ペインを考慮できず、同じviewport幅でも利用可能幅が異なるため今回の要件に適合しない。

## Verification

- ConversationWorkspaceのクラス契約テストで、chat-only、minimap+chat、chat+summary、all-columnsの状態指定を確認する。
- ミニマップとスレッドサマリにコンポーネント自身の最小幅がないことを確認する。
- WDIOで800pxから2400pxまでの12幅を撮影し、各幅で表示状態、チャット最大幅、サマリの領域内配置を確認する。
- ユニットテスト、型検査、Lint、`git diff --check`を実行する。
