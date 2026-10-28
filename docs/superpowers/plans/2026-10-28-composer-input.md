# Composer Input Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** チャット画面の入力パネルを画面下部に固定し、Shift+Enter送信と送信種別dropdownを追加する。

**Architecture:** `ConversationWorkspace`をviewport内のflex columnにし、`TaskActivityTimeline`だけをスクロール領域として残す。`Composer`は既存のSend / Steer / Queue mutationを維持し、`ComposerOptions`からmode selectを分離して、送信ボタン右側の`SubmissionModeMenu`へ移す。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、Tailwind CSS / daisyUI

**Spec:** `docs/superpowers/specs/2026-10-28-composer-input-design.md`

## Global Constraints

- `Shift+Enter`はform submitとして扱い、通常の`Enter`はtextareaの改行を維持する。
- Send / Steer / Queueの既存App Server APIとpayloadは変更しない。
- 画像添付、Plan mode、Stop、エラー表示、既存の`/chat/:threadId` deep linkを維持する。
- Model / Providerに関する表示や機能は追加しない。
- 活動履歴以外のページ全体スクロールに依存せず、Composerを画面下部の固定flex領域にする。
- 実装はテスト先行で行う。

## Review Focus

- 空入力や画像だけの入力でShift+Enterしても送信しないことをComposer testで固定する。
- active turnがないとき、Steer / Queueをdropdownから選べないことをComposerOptions testで固定する。
- 送信種別を変更しても、送信ボタンが選択中のSend / Steer / Queueを実行することをComposer testで固定する。
- 送信失敗後に入力本文と添付画像を保持する既存挙動を回帰テストで確認する。
- 長いActivityがあってもComposerがflex下端に残るレイアウトクラスをConversationWorkspace UI testで確認する。

### Task 1: Composerのキーボード送信と送信種別dropdown

**Files:**
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/ComposerOptions.tsx`
- Modify: `src/components/conversation/Composer.test.tsx`
- Modify: `src/components/conversation/ComposerOptions.test.tsx`

**Interfaces:**
- `ComposerOptions`はmode selectを描画せず、Plan modeと画像添付を受け持つ。
- `SubmissionModeMenu`は`activeTurnId`, `disabled`, `mode`, `onModeChange`を受け取り、送信種別を選択する。
- `Composer`は現在の`mode`を`SubmissionModeMenu`へ渡し、送信ボタン本体と右側の細い展開ボタンを同じjoin groupで描画する。

- [ ] **Step 1: Shift+Enterとdropdownの失敗テストを書く**

  `Composer.test.tsx`に、通常Enterでは送信せずShift+Enterで`sendMutation`が呼ばれるテストを追加する。`ComposerOptions.test.tsx`に、mode selectが存在せず、`Submission mode menu`からSend / Steer / Queueを選べること、active turnなしではSteer / Queueがdisabledであることを追加する。

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

  Run: `node_modules/.bin/vitest run src/components/conversation/Composer.test.tsx src/components/conversation/ComposerOptions.test.tsx`

  Expected: 新しいShift+Enter、menu、disabled状態のテストがFAILする。

- [ ] **Step 3: `SubmissionModeMenu`とShift+Enterを実装する**

  `ComposerOptions.tsx`から`select`を削除し、`details`または同等のcontrolled menuで`SubmissionModeMenu`を追加する。`Composer.tsx`のtextarea `onKeyDown`で`event.key === "Enter" && event.shiftKey`だけ`requestSubmit()`し、通常Enterはdefault動作の改行にする。送信本体とdropdownを隣接したjoin groupに置く。

- [ ] **Step 4: focused testと全Frontend testを実行する**

  Run: `node_modules/.bin/vitest run src/components/conversation/Composer.test.tsx src/components/conversation/ComposerOptions.test.tsx` と `node_modules/.bin/vitest run`

  Expected: 新規テストと既存325件を含む全テストが通る。

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/conversation/Composer.tsx src/components/conversation/ComposerOptions.tsx src/components/conversation/Composer.test.tsx src/components/conversation/ComposerOptions.test.tsx
  git commit -m "feat: improve composer submission controls"
  ```

### Task 2: チャット画面のComposer固定レイアウト

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- `ConversationWorkspace`は既存のloading/error/header/context/timeline/Composer構造を維持する。
- `TaskActivityTimeline`は`flex-1 min-h-0 overflow-y-auto`の唯一の活動スクロール領域として利用する。
- Composerは`shrink-0`の下部領域に置き、ページの縦スクロールに依存しない。

- [ ] **Step 1: 固定レイアウトの失敗テストを書く**

  `ConversationWorkspace.ui.test.tsx`で、Composer mockを`data-testid="composer"`として描画し、Workspace rootがviewport相当の`h-[calc(100dvh-9rem)]`、timelineが`flex-1 min-h-0 overflow-y-auto`、Composer領域が`shrink-0`を持つことを確認する。

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

  Run: `node_modules/.bin/vitest run src/components/conversation/ConversationWorkspace.ui.test.tsx`

  Expected: 現在の`min-h`中心のレイアウトでは新しいheight/shrink assertionsがFAILする。

- [ ] **Step 3: `ConversationWorkspace`をviewport内flex columnへ変更する**

  rootを`h-[calc(100dvh-9rem)] min-h-0`に変更し、既存timelineをflex領域として使う。Composerは`shrink-0` wrapper内に置く。TaskContextPanelやエラー表示の既存挙動は保持する。

- [ ] **Step 4: focused test、全Frontend checksを実行する**

  Run: `node_modules/.bin/vitest run src/components/conversation/ConversationWorkspace.ui.test.tsx && node_modules/.bin/tsc --noEmit && node_modules/.bin/biome lint . && node_modules/.bin/eslint src --max-warnings 0 && node_modules/.bin/vitest run && node_modules/.bin/vite build && git diff --check`

  Expected: 全テスト、型検査、Lint、Build、diff checkが成功する。

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/conversation/ConversationWorkspace.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx docs/superpowers/specs/2026-10-28-composer-input-design.md docs/superpowers/plans/2026-10-28-composer-input.md
  git commit -m "fix: keep chat composer at viewport bottom"
  ```

### Task 3: 最終確認

**Files:**
- Modify: related files only if regression tests expose a defect.

- [ ] **Step 1: Native frontend and Rust verification**

  Run: `node_modules/.bin/vitest run`, `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/biome lint .`, `node_modules/.bin/eslint src --max-warnings 0`, `node_modules/.bin/vite build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.

- [ ] **Step 2: Manual GUI acceptance**

  `/chat/:threadId`で長いActivityを作り、Activityだけがスクロールすること、Composerが画面下部に残ること、通常Enterが改行、Shift+Enterが送信、送信ボタン右の矢印からSend / Steer / Queueを選択できることを確認する。active turnなしのSteer / Queueが選べないこと、画像添付とPlan modeが維持されることも確認する。

- [ ] **Step 3: Commit**

  ```bash
  git add -u
  git commit -m "test: verify composer input improvements"
  ```

## Dependency order

1. Task 1: Composerの送信操作と種別UI
2. Task 2: ConversationWorkspaceの固定レイアウト
3. Task 3: 全体検証
