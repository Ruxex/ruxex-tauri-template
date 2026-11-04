# Slash Command Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存チャットの Composer で `/` 入力時に Archive / Compact / Goal を選択できる palette を表示し、操作を既存 App Server API に接続する。

**Architecture:** slash command の候補と入力変換を純粋な model module に分離する。`Composer` は palette の表示と mutation の実行だけを担当し、Archive/Compact は選択時に実行、Goal は後続文を Composer の既存 goal mode で送信する。

**Tech Stack:** React, TypeScript, TanStack Query mutations, Vitest, Testing Library, DaisyUI, Heroicons.

**Spec:** `docs/superpowers/specs/2026-11-04-slash-command-selector-design.md`

## Global Constraints

- 対象は既存チャットの `src/components/conversation/Composer.tsx` のみ。`NewChatComposer` には追加しない。
- 選択肢は Archive、Compact、Goal の3つだけにする。
- Archive と Compact は選択時に実行し、Goal は後続の文章を送信した時に実行する。
- App Server protocol の生成ファイルは変更せず、既存の `thread/compact/start` を利用する。
- 今回変更しない既存の `ChatActivityTimeline.tsx` の Biome 警告は修正しない。

## Review Focus

- `/` だけ、部分入力、`/goal` 後の文章で候補と入力変換が期待どおりになることを model test で固定する。
- Archive / Compact の mutation が thread ID だけを送信し、成功時に Composer の入力を消すことを hook/UI test で固定する。
- Goal 選択が即時に API を呼ばず、後続文を送信した時だけ `thread/goal/set` を呼ぶことを UI test で固定する。
- palette 表示中でも既存の Send、Steer、Queue、画像添付、IME、Goal mode が壊れないことを既存 suite で確認する。
- mutation 失敗時に既存の Composer エラー表示へ流れ、入力を失わないことを UI test で確認する。

---

### Task 1: Slash command model

**Files:**
- Create: `src/components/conversation/slash-command.ts`
- Test: `src/components/conversation/slash-command.test.ts`

**Interfaces:**
- Produces `slashCommands`, `SlashCommandId`, `getSlashCommandInput(message)`, and `selectSlashCommand(message, command)` for the Composer and palette.
- `getSlashCommandInput` returns `null` unless the first character is `/`; otherwise it returns the command query and keeps the command palette active.
- `selectSlashCommand` returns either an immediate command (`archive`/`compact`) or Goal mode plus the text after the selected command token.

- [ ] **Step 1: Write failing tests** for non-slash input, `/`, partial command input, preserving Goal suffix text, and immediate command selection.
- [ ] **Step 2: Run the focused Vitest file** and verify it fails because the model module does not exist.
- [ ] **Step 3: Implement the minimal immutable command definitions and input transformation.** Keep the command labels and IDs local to this module.
- [ ] **Step 4: Run the focused Vitest file** and verify all model cases pass.

### Task 2: Compact mutation hook

**Files:**
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`

**Interfaces:**
- Produces `useCompactThread()`, accepting `{ threadId: string }` and invoking `requestAppServerMethod("thread/compact/start", params)`.
- On success, invalidate the thread conversation query so the compacted transcript is reloaded.

- [ ] **Step 1: Add the hook mapping case and invalidation expectation to the existing hook test.**
- [ ] **Step 2: Run the focused hook test** and verify it fails because `useCompactThread` is not exported/implemented.
- [ ] **Step 3: Implement `useCompactThread` using the existing mutation and query invalidation patterns.**
- [ ] **Step 4: Run the hook test** and verify request mapping and invalidation pass.

### Task 3: Slash command palette UI

**Files:**
- Create: `src/components/conversation/SlashCommandPalette.tsx`
- Test: `src/components/conversation/SlashCommandPalette.test.tsx`

**Interfaces:**
- Consumes `disabled: boolean`, `onSelect(command: SlashCommandId): void`, and the command definitions from Task 1.
- Produces an accessible palette above the textarea with exactly three `menuitem` buttons: Archive, Compact, and Goal.

- [ ] **Step 1: Write the failing render and selection tests** for the three options, disabled state, and callback command IDs.
- [ ] **Step 2: Run the focused component test** and verify it fails because the component does not exist.
- [ ] **Step 3: Implement the palette using existing DaisyUI menu/dropdown styling and Heroicons where appropriate.** Keep it inline above the textarea rather than a browser dropdown.
- [ ] **Step 4: Run the focused component test** and verify rendering and selection pass.

### Task 4: Integrate the palette into Composer

**Files:**
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/Composer.test.tsx`

**Interfaces:**
- Consumes Task 1's parser/selection result, Task 2's `useCompactThread`, and Task 3's `SlashCommandPalette`.
- Keeps existing `goalMode` submission behavior and extends pending/error aggregation to archive and compact mutations.

- [ ] **Step 1: Add failing UI tests** for palette visibility on `/`, Archive immediate execution, Compact immediate execution, and Goal selection followed by text submission.
- [ ] **Step 2: Run the focused Composer tests** and verify the new tests fail while existing Composer tests remain diagnostic.
- [ ] **Step 3: Add the textarea ref, slash visibility state, selection handler, archive/compact mutations, and palette above the textarea.** Clear only after successful immediate actions; preserve the message when a mutation rejects; focus the textarea after Goal selection.
- [ ] **Step 4: Run the focused Composer tests** and verify all new and existing cases pass.
- [ ] **Step 5: Run the full frontend test suite** and verify no regression in conversation, app-server, or page tests.

### Task 5: Verification and handoff

**Files:**
- Review: `docs/superpowers/specs/2026-11-04-slash-command-selector-design.md`
- Review: all files changed by Tasks 1–4

- [ ] **Step 1: Run `cargo fmt --all -- --check` and `cargo test --locked --manifest-path src-tauri/Cargo.toml`.**
- [ ] **Step 2: Run frontend typecheck, ESLint, Vitest, package tests, and Vite build using the repository's configured Node runtime.**
- [ ] **Step 3: Run `git diff --check` and inspect the staged diff to ensure only the slash command feature and its design/plan docs are included.**
- [ ] **Step 4: Commit the implementation with a focused message.**
