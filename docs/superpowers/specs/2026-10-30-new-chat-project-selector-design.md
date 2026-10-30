# New chat project selector design

## Intent

NewChat でスレッドを開始する前にプロジェクトだけを選択できるようにし、入力内容がどのプロジェクトで実行されるかを送信前に明確にする。

## Scope

- `NewChatComposer` に既存の `ProjectSelector` を接続する。
- セレクタは NewChat の入力フォーム直上に置き、同じ幅・境界線を共有する帯として表示する。
- URL の `projectId` がある場合は初期選択値にする。
- 選択変更時は選択済みプロジェクトを使い、そのプロジェクトの root をスレッド作成へ渡す。
- 「No project」は維持し、プロジェクトなしの NewChat も開始できるようにする。
- 既存チャットの入力パネルや他ページにはセレクタを表示しない。

## Non-goals

- ProjectSelector の選択肢やプロジェクト API の仕様は変更しない。
- モデル、権限、添付、Plan / Goal など既存の composer 操作は変更しない。
- 既存チャットのプロジェクト変更機能は追加しない。

## Approach

`NewChatComposer` が `useProjectList` と選択状態を保持し、既存の `useProject` を選択済み ID に対して実行する。`ProjectSelector` を form の兄弟要素として同じ `max-w-3xl` コンテナ内に置き、セレクタ帯の下辺と composer form の上辺を接続して一体化する。送信処理は既存の `selectedProjectId` と読み込んだ root を利用する。

## Verification

- NewChat に Project セレクタが表示され、No project と取得済みプロジェクトを選べることを UI テストで確認する。
- URL の projectId が初期選択され、選択変更後の projectId と root が thread 作成へ渡ることを確認する。
- 既存の送信、Goal、Plan、添付のテストと全体テストが通ることを確認する。
