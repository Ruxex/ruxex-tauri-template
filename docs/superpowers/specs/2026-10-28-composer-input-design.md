# チャット入力パネル改善 設計

## Intent

チャット画面で活動履歴をスクロールしても入力パネルを画面下部に残し、キーボード中心の送信操作と送信種別の選択を使いやすくする。

## Goals

- Task headerとComposerを固定領域にし、活動タイムラインだけをスクロール可能にする。
- `Shift+Enter`で送信する。通常の`Enter`は入力中の改行として扱う。
- 送信種別（Send / Steer / Queue）は左側のselectを廃止し、送信ボタン右側の細い展開ボタンから選択する。
- 既存の画像添付、Plan mode、Stop、Send / Steer / Queue APIを維持する。

## Non-goals

- 送信API、送信種別の意味、Composer以外のチャット操作は変更しない。
- モバイル専用の別Composerや新しいショートカット体系は追加しない。

## Approach

ConversationWorkspaceをviewport内のflex columnにし、TaskActivityTimelineを唯一のスクロール領域にする。Composerは通常のflex固定領域として下端に置くため、本文のスクロール位置に影響されない。

Composerの送信種別UIは、既存の`SubmissionMode`と`availableSubmissionModes()`を再利用した分割ボタンのdropdownにする。送信本体は現在選択中の種別を実行し、右側の矢印ボタンは種別メニューだけを開く。`Shift+Enter`はform submitへ委譲し、画像添付時も同じ送信経路を通す。

## Verification

- Composer testで`Shift+Enter`送信、通常Enter改行、送信種別dropdown、無効なSteer / Queueを確認する。
- ConversationWorkspaceのレイアウトクラスと既存全体テストを確認する。
- TypeScript、Biome、ESLint、Vitest、Vite buildを実行する。
