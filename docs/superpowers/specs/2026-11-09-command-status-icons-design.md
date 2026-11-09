# Command status icons design

## Intent

コマンド実行アクティビティの診断情報を、短いラベル文字列ではなく状態に対応するアイコンで読み取れるようにする。実行中のスピナーは見出し内で正しく中央配置し、既存UIより高いコントラストで表示する。

## Goals

- `CommandExecutionView` の status 表示を状態アイコンへ置き換える。
- `inProgress` / `running` は中央配置された高コントラストのスピナーにする。
- `completed` は緑のチェック、失敗・異常状態は黄色の警告アイコンにする。
- 終了コード `0` は成功アイコンのみ表示し、非0は赤いエラーアイコンと `Exit code: N` を表示する。
- Command / Status / Summary の冗長な説明文字を画面上から除き、ARIAラベルとツールチップで意味を保持する。
- 既存のコマンド、出力、開閉、メタデータ表示の構造とバックエンドデータモデルは変更しない。

## Non-goals

- コマンド実行状態の判定ロジックや App Server プロトコルの変更。
- コマンド出力のMarkdownレンダリングやカード全体の再設計。
- チャット一覧など、別画面のステータスアイコンの変更。

## Approaches

1. `CommandExecutionView` 内で各状態を直接分岐する。変更量は小さいが、状態表現が再利用しにくい。
2. 共通の `ExecutionStatusIcon` を小さく新設し、状態アイコン・色・アクセシビリティ名を分離する。表示ルールを一箇所で検証でき、Activity の見出しと診断欄で共有できるため採用する。
3. コマンドカード全体を「コマンド／結果／診断」の新しいレイアウトへ再構成する。今回の目的に対して変更範囲と回帰リスクが大きいため採用しない。

## Design

- `ExecutionStatusIcon` は固定サイズの `inline-flex` 枠で、`items-center justify-center` を使ってスピナーを上下中央に配置する。
- 実行中は既存のHeroicons/DaisyUI依存を使い、スピナー自体に十分な `text-primary` コントラストと `size-4` 相当の領域を与える。
- 完了は `CheckCircleIcon` の緑、状態エラーは `ExclamationTriangleIcon` の黄色、終了コード非0は `XCircleIcon` の赤で表す。
- 0の終了コードはアイコンのみ、非0はアイコンと数値を表示する。数値には `Exit code: N` のアクセシブルな説明を付ける。
- 既存の診断欄はアイコン中心の横並びにし、状態アイコンには `aria-label` と `title` を設定する。可視テキストは必要な非0終了コードだけに限定する。

## Verification

- 状態ごとのアイコン、色、ARIAラベルをコンポーネントテストで検証する。
- `completed` と終了コード `0` が説明ラベル文字列を表示しないことを検証する。
- 非0終了コードだけが数値を表示することを検証する。
- ActivityItem の既存のコマンド・出力・開閉動作を維持する。
- `make check-tests`、`git diff --check`、最終差分確認を実行する。
