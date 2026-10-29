# Desktop Text Selection Design

## Intent

デスクトップアプリの UI はドラッグ操作でテキスト選択できないようにし、ブラウザ的な操作感を抑える。一方で、ユーザーが読み返したりコピーしたりするチャット本文と、編集対象の入力欄は選択可能にする。

## Scope

- アプリ全体の通常 UI は `user-select: none` にする。
- `input`、`textarea`、編集可能要素は選択可能にする。
- Markdown を含むチャット本文と、チャット内のアクティビティ本文は選択可能にする。
- ボタン、ナビゲーション、カード、設定ラベルなどの UI は選択不可にする。

## Approach

グローバル CSS でデフォルトを選択不可にし、フォーム要素と明示的な `.selectable-content` クラスだけ `user-select: text` に戻す。個別コンポーネントへ大量に `select-none` を追加する方式は、将来の UI 追加時に漏れやすいため採用しない。

## Constraints

- チャット本文の選択可能範囲は本文コンテナに限定し、周辺 UI の選択不可を維持する。
- 既存の入力、コピー、キーボード操作、Markdown 表示を変更しない。
- Tauri/Rust 側の変更や新規依存関係は追加しない。

## Verification

- チャット本文と入力欄に選択可能クラスが付くことをコンポーネントテストで確認する。
- グローバル CSS に選択不可の既定値と例外ルールがあることを静的に確認する。
- 全 Vitest、TypeScript、Biome、ESLint、Vite build を実行する。
