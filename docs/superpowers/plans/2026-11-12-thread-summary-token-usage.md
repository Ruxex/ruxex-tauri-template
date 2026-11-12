# Thread Summary Token Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 右列のスレッドサマリパネルに、現在のスレッドのトークン使用量を表示する。

**Architecture:** App Serverの `thread/tokenUsage/updated` 通知を既存のイベントストア内でスレッド別に保持し、`ThreadSummaryPanel` が購読して表示する。初回表示時に既存通知がない場合は空状態とし、料金やプロトコル拡張は扱わない。

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Tailwind/DaisyUI

**Spec:** `docs/superpowers/specs/2026-11-12-thread-summary-token-usage-design.md`

## Global Constraints

- 生成コードは変更せず、既存の `ThreadTokenUsage` 型を利用する。
- App Serverプロトコルや料金モデルを拡張しない。
- 既存のイベント駆動設計を再利用し、追加ポーリングを行わない。
- 表示ラベルは既存UIに合わせた英語とする。

## Review Focus

- 通知が別スレッドの使用量を上書きしないこと — イベントストアの reducer/store テストで確認する。
- `modelContextWindow` が null の場合に不自然な値を表示しないこと — 表示テストで確認する。
- 使用量通知がまだない状態でも既存パネルが壊れないこと — 表示テストで確認する。
- 各内訳が大きな数値でも読みやすく表示されること — 表示テストで確認する。
- 再接続・イベント再同期時に最新値が保持されること — イベント同期テストで確認する。

### Task 1: イベントストアにスレッド別トークン使用量を保持する

**Files:**
- Modify: `src/app-server/event-reducer.ts`
- Modify: `src/app-server/event-store.ts`
- Test: `src/app-server/event-reducer.test.ts`
- Test: `src/app-server/event-store-react.test.tsx`（既存の購読パターンに合わせる）

**Interfaces:**
- Consumes: `ServerNotification` の `thread/tokenUsage/updated` と `v2.ThreadTokenUsage`
- Produces: `threads[threadId].tokenUsage` と、Reactから参照できるスレッド活動スナップショット

- [ ] **Step 1: 通知を適用する失敗テストを書く**
  - 同一スレッドの通知で `tokenUsage` が更新されること。
  - 別スレッドの通知が既存値を変更しないこと。
  - 通知が再適用されても最新値が保持されること。
- [ ] **Step 2: テストが失敗することを確認する**
  - Run: `pnpm vitest run src/app-server/event-reducer.test.ts`
  - Expected: token usage state/assertion failures.
- [ ] **Step 3: reducer/storeに最小実装を追加する**
  - `ThreadActivityState` に optional な `tokenUsage` を追加する。
  - `thread/tokenUsage/updated` を対象スレッドの状態へ反映する。
  - 既存の接続・再同期・購読APIの形は変更しない。
- [ ] **Step 4: テストが通ることを確認する**
  - Run: `pnpm vitest run src/app-server/event-reducer.test.ts src/app-server/event-store-react.test.tsx`
  - Expected: PASS.

### Task 2: サマリパネルにトークン使用量を表示する

**Files:**
- Create: `src/components/thread-summary/TokenUsageSection.tsx`
- Create: `src/components/thread-summary/TokenUsageSection.test.tsx`
- Modify: `src/components/thread-summary/ThreadSummaryPanel.tsx`
- Modify: `src/app-server/hooks/useAppServerEvents.ts`

**Interfaces:**
- Consumes: `useAppServerEvents()` のスレッド別活動状態と `threadId`
- Produces: `TokenUsageSection` — `usage: v2.ThreadTokenUsage | null` を受け取り表示する純粋なUIコンポーネント

- [ ] **Step 1: 表示の失敗テストを書く**
  - 合計トークン、直近ターンのトークン、入力、出力、推論出力を表示すること。
  - `modelContextWindow` がある場合のみコンテキスト上限を表示すること。
  - usageが null の場合に「No token usage yet」を表示すること。
  - `Intl.NumberFormat("en-US")` 相当で大きな数値を桁区切り表示すること。
- [ ] **Step 2: テストが失敗することを確認する**
  - Run: `pnpm vitest run src/components/thread-summary/TokenUsageSection.test.tsx`
  - Expected: missing component/assertion failures.
- [ ] **Step 3: UIコンポーネントとパネル接続を実装する**
  - パネル内のSubagentsセクションより前にToken Usageセクションを追加する。
  - 通知状態から `events.threads[threadId]?.tokenUsage ?? null` を渡す。
  - 既存の選択状態・TBDセクション・レイアウトを変更しない。
- [ ] **Step 4: テストが通ることを確認する**
  - Run: `pnpm vitest run src/components/thread-summary/TokenUsageSection.test.tsx src/components/thread-summary/ThreadSummaryPanel.test.tsx`
  - Expected: PASS.

### Task 3: 統合確認

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

- [ ] **Step 1: ワークスペースの表示テストにトークン使用量通知のケースを追加する**
  - 右列のThread Summary内に合計トークンが表示されることを確認する。
- [ ] **Step 2: 関連テストを実行する**
  - Run: `pnpm vitest run src/app-server/event-reducer.test.ts src/app-server/event-store-react.test.tsx src/components/thread-summary/TokenUsageSection.test.tsx src/components/thread-summary/ThreadSummaryPanel.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx`
  - Expected: PASS.
- [ ] **Step 3: 型・ビルド検証を実行する**
  - Run: `pnpm lint` and `pnpm build`
  - Expected: PASS.

