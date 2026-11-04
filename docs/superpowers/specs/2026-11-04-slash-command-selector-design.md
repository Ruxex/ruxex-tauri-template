# Slash Command Selector Design

## Intent

既存チャットの入力欄で `/` から始まる入力を検知し、チャット操作を選択できるコマンドセレクタを表示する。チャット本文に操作用の文字列を送信するのではなく、既存の App Server API を直接呼び出す。

## Goals

- 既存チャットの `Composer` の入力欄上部に、`/` 入力時だけセレクタを表示する。
- 選択肢は Archive、Compact、Goal の3つに限定する。
- Archive と Compact は選択時に即時実行する。
- Goal は選択時に Goal 入力モードへ切り替え、後続の文章を通常の Goal として送信した時に実行する。
- 既存の Goal mode、送信中状態、エラー表示、App Server の mutation hook パターンを再利用する。

## Non-goals

- 新規チャット用の `NewChatComposer` へのコマンド追加。
- 任意の slash command の登録・プラグイン化。
- Archive / Compact に文章引数を渡す仕様。
- App Server protocol の変更。`thread/compact/start` は既存の protocol 定義を利用する。

## Constraints

- UI は現在の DaisyUI と Heroicons の既存パターンに合わせる。
- 既存の入力・画像添付・Queue/Steer/Send の挙動を壊さない。
- Archive と Compact は実行中に再実行できないよう mutation の pending 状態を Composer の disabled 状態へ含める。
- コマンド選択後は入力欄へフォーカスを戻し、Goal の場合は後続テキストを入力できる状態にする。

## Approaches

1. Composer 内に処理と UI を直接追加する。変更量は少ないが、入力解析とメニュー表示が Composer に集中する。
2. slash command の定義・解析を小さなモデル module に分離し、表示コンポーネントと Composer はそれを利用する。テストしやすく、今後の command 追加にも対応しやすい。
3. 既存の ComposerOptions を slash command の表示にも流用する。見た目の重複は減るが、通常の options menu と入力連動 palette の責務が混ざる。

Approach 2 を採用する。今回の選択肢は少ないが、入力解析・選択結果・実行条件を UI から分離でき、`/` だけ、部分入力、Goal の後続文といった境界を小さなテストで固定できるため。

## Behavior

- `message` の先頭が `/` の間、palette を表示する。
- Archive / Compact の選択は、それぞれ `useArchiveThread` / 新設する compact mutation を呼び、成功後に入力をクリアする。
- Goal の選択は `goalMode` を有効にし、slash command 部分を入力欄から取り除く。ユーザーが入力した後続文を送信すると、既存の `useSetThreadGoal` で goal を開始する。
- slash command が選択されていない通常の入力は従来どおり `send` / `steer` / `queue` の処理を行う。
- 新規チャット画面では thread ID が存在しないため palette を表示しない。

## Test boundary

- slash 入力の検知と command 選択後の状態変換を純粋なテストで確認する。
- Composer UI で `/` 入力時に3項目が表示されることを確認する。
- Archive / Compact 選択が対応する mutation を呼び、Goal 選択が goal 入力モードへ切り替わることを確認する。
- 既存 Composer の送信、画像、Queue/Steer、Goal mode のテストが継続して成功することを確認する。
