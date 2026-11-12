# Responsive Chat Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** チャット領域の実効幅に応じて、チャット・ミニマップ・スレッドサマリを優先順位どおりに表示する。

**Architecture:** `AppLayout` のチャット領域を名前付きinline-size containerにし、`ConversationWorkspace` がTailwindのcontainer-query variantで4つの表示状態を切り替える。各列は自身の表示判定を持たず、チャット領域のスクロール境界とコンポジション固定は既存構造を維持する。

**Tech Stack:** React 19, Tailwind CSS v4, Vitest, WebdriverIO/Tauri E2E.

**Spec:** `docs/superpowers/specs/2026-11-12-responsive-chat-columns-design.md`

## Global Constraints

- 表示判定はviewport幅ではなくチャット領域の実効幅を使う。
- 表示優先順位はチャット、スレッドサマリ、ミニマップの順とする。
- チャット列の最大幅は `53rem` 前後とする。
- スレッドサマリコンポーネント自身に `min-width` を設定しない。
- レイアウトの新規指定はTailwindを優先し、同じ責務のcustom CSSを追加しない。
- 左右の補助列が非表示のとき、余白だけを残さない。

## Review Focus

- 左ペインや右ペインの開閉でチャット領域幅が変わったとき、表示状態がviewport幅に取り残されないこと。→ WDIOの実効幅で確認。
- スレッドサマリがミニマップより先に表示されること。→ 4状態のクラス契約テストとWDIOで確認。
- 3列表示時にチャット列が最大幅を超えず、サマリがworkspace外にはみ出さないこと。→ WDIOで確認。
- 補助列が非表示のとき内容と余白が残らないこと。→ 列の `w-0`/`overflow-hidden` 契約テストで確認。
- チャット領域のスクロールと画面下部のコンポジション固定が維持されること。→ AppLayout/ConversationWorkspace既存テストで確認。

### Task 1: Responsive layout contract tests

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Modify: `src/components/conversation/ConversationMinimap.test.tsx`
- Modify: `src/components/thread-summary/ThreadSummaryPanel.test.tsx`
- Modify: `fixtures/dummy-home/responsive-chat-columns.spec.ts`

**Interfaces:**
- Consumes: Existing workspace and column test fixtures.
- Produces: Tests that fail until the workspace uses container-based four-state layout classes and the columns have no component-level minimum width.

- [ ] **Step 1: Write the failing tests** for the four visual states, container marker, absence of viewport-specific chat grid classes, and no summary component `min-w-*` class.
- [ ] **Step 2: Run the focused tests** and confirm they fail because the current implementation uses viewport breakpoints and the old class contract.
- [ ] **Step 3: Update the WDIO expectations** to the approved sequence: chat only, minimap+chat, chat+summary, all columns.
- [ ] **Step 4: Run the focused tests** again to confirm the tests still express the intended behavior and fail only on production implementation.

### Task 2: Implement effective-width responsive layout

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ConversationMinimap.tsx`
- Modify: `src/components/thread-summary/ThreadSummaryPanel.tsx`

**Interfaces:**
- Consumes: Task 1's four-state layout contract.
- Produces: A named chat-size container and Tailwind container-query layout that selects the highest-priority fitting visual state.

- [ ] **Step 1: Add the named inline-size container** to the existing chat content wrapper in `AppLayout` without changing its scroll boundary.
- [ ] **Step 2: Replace viewport-based workspace grid classes** with Tailwind container-query variants for the four states; keep the chat main at `max-w-[53rem]` and remove forced workspace minimum width.
- [ ] **Step 3: Keep minimap and summary columns width-safe** with `min-w-0` and `overflow-hidden`, and remove any component-level summary minimum width.
- [ ] **Step 4: Run the focused unit tests** and confirm the four-state contract passes.

### Task 3: Visual verification and cleanup

**Files:**
- Modify: `src/styles/index.css` only if obsolete chat layout rules remain.
- Modify: tests only where assertions describe removed viewport layout behavior.

**Interfaces:**
- Consumes: Task 2's responsive implementation.
- Produces: Verified screenshots and a clean project-wide test/type/lint result.

- [ ] **Step 1: Build the E2E desktop app and run the 12-width WDIO screenshot spec.** Confirm the expected minimap/summary sequence, chat maximum width, and summary containment.
- [ ] **Step 2: Inspect the captured screenshots** at the state boundaries and confirm no large empty right region, overlap, or column scrolling regression.
- [ ] **Step 3: Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, and `git diff --check`.**
- [ ] **Step 4: Re-run the WDIO spec after any cleanup and record the final artifact path.**
