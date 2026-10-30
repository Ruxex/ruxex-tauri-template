# Chat status icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左ペインのチャット一覧で、ステータス文字を固定サイズの状態アイコンへ置き換え、チャット名の位置を安定させる。

**Architecture:** `ChatListItem` はタイトル行のレイアウトとステータス有無だけを担当し、状態別のアイコンとアクセシビリティ名は新しい `ChatStatusIcon` に分離する。既存の `ChatStatus` とステータス判定ロジックは再利用し、一覧表示の範囲だけを変更する。

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Tailwind CSS, DaisyUI, Heroicons.

**Spec:** `docs/superpowers/specs/2026-10-30-chat-status-icons-design.md`

## Global Constraints

- ステータスの判定ロジックや App Server のデータモデルは変更しない。
- ステータスがない場合はアイコン領域を表示しない。
- `running / completed / waiting / failed / stopped` は同じ `size-4 shrink-0` の領域で表示する。
- 画面上のステータス文字は削除し、アクセシビリティ用の状態名は `aria-label` に残す。
- 依存関係は追加せず、既存の Heroicons と DaisyUI spinner を利用する。

## Review Focus

- ステータスなし: アイコン領域を出さず、タイトルの先頭に余白だけを残さないこと（Task 1）。
- `running` と `completed` の切り替え: 同じサイズの領域で spinner と緑の完了アイコンが表示されること（Task 1）。
- `waiting / failed / stopped`: 各状態が文字 badge に戻らず、対応するアイコンとアクセシビリティ名になること（Task 1）。
- コンテキスト情報のみ: status がなくても project/worktree 表示が維持されること（Task 1）。
- 横幅の安定性: リンクの左パディングとアイコン枠のクラスが要求値を満たすこと（Task 1）。

### Task 1: Define the chat status icon behavior with failing UI tests

**Files:**
- Modify: `src/components/chats/ChatListItem.test.tsx`

**Interfaces:**
- Consumes: Existing `ChatListItem` props and `ChatStatus` values.
- Produces: Regression coverage for all five icon states, status-less rows, and the updated left padding.

- [ ] **Step 1: Write the failing tests**

  Update the existing running-status test to assert:
  - the link class contains `px-2` and `py-1`;
  - `role="status"` with accessible name `Chat status: Running` exists;
  - visible `Running` text is absent;
  - project/worktree context remains visible.

  Add a table-driven test for `running`, `completed`, `waiting`, `failed`, and `stopped` that renders one `ChatListItem` per status and asserts the corresponding `Chat status: ...` status exists while the capitalized status text is not rendered as visible content. Assert the completed status element includes `text-success`.

  Add a status-less test that asserts no `role="status"` exists and that the chat title still renders. Keep the existing preview and untitled fallback assertions.

- [ ] **Step 2: Run the focused test to verify the failure**

  Run: `pnpm exec vitest run src/components/chats/ChatListItem.test.tsx`

  Expected: FAIL because the current implementation still uses `px-1.5` and renders status text in a badge instead of the requested icon semantics.

### Task 2: Add the fixed-size status icon component

**Files:**
- Create: `src/components/chats/ChatStatusIcon.tsx`

**Interfaces:**
- Consumes: `ChatStatus` from `src/components/chats/chat-status.ts`.
- Produces: `ChatStatusIcon({ status }: { status: ChatStatus })`, rendering one fixed-size status icon with `role="status"` and `aria-label={Chat status: <Label>}`.

- [ ] **Step 1: Implement `ChatStatusIcon` minimally**

  Use a wrapper with `className="inline-flex size-4 shrink-0 items-center justify-center"`. Render the existing DaisyUI spinner for `running`; render `CheckCircleIcon` with `text-success` for `completed`; render `PauseCircleIcon` with `text-warning` for `waiting`; render `ExclamationCircleIcon` with `text-error` for `failed`; and render `StopCircleIcon` with `text-base-content/50` for `stopped`. Give each icon `aria-hidden="true"` and `className="size-4"`; put the accessible status name on the wrapper.

- [ ] **Step 2: Run the focused test while the list still uses the old rendering**

  Run: `pnpm exec vitest run src/components/chats/ChatListItem.test.tsx`

  Expected: The focused test remains FAIL until `ChatListItem` is wired to the new component; this confirms the tests are testing the visible list behavior rather than only the new component in isolation.

### Task 3: Place status icons before titles and update list spacing

**Files:**
- Modify: `src/components/chats/ChatListItem.tsx`

**Interfaces:**
- Consumes: `ChatStatusIcon` from `./ChatStatusIcon` and the existing optional `status` prop.
- Produces: A title row that conditionally contains the fixed-size status icon followed by the chat title; the existing project/worktree context row without status text.

- [ ] **Step 1: Wire the component into the title row**

  Change the link padding from `px-1.5` to `px-2`. Wrap the optional status icon and title in a flex row with `min-w-0 items-center gap-2`. Render `ChatStatusIcon` only when `status` is defined. Remove the status badge and status label from the lower metadata row; keep project and worktree labels there when present.

- [ ] **Step 2: Run the focused tests to verify the implementation passes**

  Run: `pnpm exec vitest run src/components/chats/ChatListItem.test.tsx`

  Expected: PASS with all status icon, no-status, title fallback, padding, and context assertions passing.

### Task 4: Run repository verification

**Files:**
- No additional files.

**Interfaces:**
- Consumes: The completed UI change and its focused regression tests.
- Produces: Fresh typecheck, lint, test, diff, and build evidence for the frontend change.

- [ ] **Step 1: Run the full frontend check suite**

  Run: `make check-tests`

  Expected: TypeScript, Biome, ESLint, and the full Vitest suite complete successfully with exit code 0.

- [ ] **Step 2: Check formatting and inspect the final diff**

  Run: `git diff --check && git diff -- src/components/chats/ChatListItem.tsx src/components/chats/ChatStatusIcon.tsx src/components/chats/ChatListItem.test.tsx docs/superpowers/specs/2026-10-30-chat-status-icons-design.md`

  Expected: no whitespace errors; the diff contains only the status-icon UI, its tests, and the approved design documentation.

- [ ] **Step 3: Run the frontend build**

  Run: `make build`

  Expected: Vite build completes successfully with exit code 0.
