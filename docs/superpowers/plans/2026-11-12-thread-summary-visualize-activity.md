# Thread Summary、Visualize、Activity Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex-compatible Thread Summary Panel with working Subagents, a TBD-only shell for the other summary sections, an Activity Center based on Approval Center, and a sandboxed HTML Visualize renderer without AppServer changes.

**Architecture:** The web client projects existing AppServer thread metadata and event-store state into new summary and activity views. Visualize remains an ordinary agent message containing a Codex-style `visualize{...}` reference; Tauri validates and reads the referenced local HTML file, while React renders it in a restricted iframe. The AppServer protocol and Rust runtime remain unchanged.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest, Testing Library, Tauri 2, Rust, existing Ruxex v2 AppServer protocol.

**Spec:** `docs/superpowers/specs/2026-11-12-thread-summary-visualize-activity-design.md`

## Global Constraints

- The Thread Summary Panel has exactly these sections: `Subagents`, `Sources / Web Search`, `Changes`, `Branch details`, and `Git actions`.
- Only `Subagents` is functional in this milestone; the other four sections render `TBD` and do not imply partial support.
- Active and Done subagent lists use existing `Thread.parentThreadId`, `agentNickname`, `agentRole`, `collabAgentToolCall`, and `subAgentActivity` data.
- The AppServer protocol and runtime are not modified.
- Visualize uses an HTML file plus `visualize{"path":"...","mode":"wide"}` reference.
- `window.openai`, `window.openai.widgetState`, `window.openai.setWidgetState`, `window.openai.sendFollowUpMessage`, and `persistent.oaistatic.com` runtimes are not used.
- Visualize HTML is loaded only from validated local roots, is limited to 1 MiB, and is rendered only inside a sandboxed iframe.
- Visualize must not use `fetch`, XHR, WebSocket, parent navigation, or direct DOM insertion into the Ruxex page.
- Existing uncommitted changes outside this feature must be preserved.

## Review Focus

- A child thread can exist without a display nickname or role; the UI must fall back to a stable label and still show the task.
  - Test in Task 1 with null nickname/role metadata.
- An Agent can transition while the Summary Panel is open; Active/Done membership must update without closing the panel.
  - Test in Task 2 with an event-store rerender.
- Pending approval can belong to an inactive child thread; it must appear in Activity and link to that child.
  - Test in Task 3 with a pending request whose `threadId` is not the current thread.
- A malformed, oversized, missing, or outside-root Visualize reference must not execute or crash the conversation renderer.
  - Test in Tasks 4 and 5 with invalid references and Tauri command errors.
- The Visualize iframe must not inherit the Ruxex app origin or gain network/parent access.
  - Test in Task 4 by asserting sandbox/CSP attributes on the rendered frame.

## File Map

### Existing files to modify

- `src/app-server/query-keys.ts` — add a stable query key for direct child-thread queries.
- `src/app-server/hooks/useThreadQueries.ts` — expose the child-thread query with fixed parent filtering.
- `src/components/conversation/ConversationWorkspace.tsx` — add the summary trigger and panel layout.
- `src/components/conversation/ConversationItem.tsx` — render message segments through the Visualize-aware message renderer.
- `src/components/approvals/ApprovalCenter.tsx` — reuse the extracted pending-request section.
- `src/app/router.tsx` — add the Activity Center route.
- `src/platform/native.ts` — expose the validated HTML file reader.
- `src-tauri/src/lib.rs` — register the new Tauri command.

### New web files

- `src/components/thread-summary/subagent-model.ts` — pure subagent row derivation and status mapping.
- `src/components/thread-summary/subagent-model.test.ts` — model tests.
- `src/components/thread-summary/ThreadSummaryPanel.tsx` — panel shell and five fixed sections.
- `src/components/thread-summary/SubagentsSection.tsx` — Active/Done list and selection.
- `src/components/thread-summary/SubagentDetail.tsx` — selected child-thread detail view.
- `src/components/thread-summary/ThreadSummaryPanel.test.tsx` — panel and navigation tests.
- `src/components/thread-summary/ThreadSummaryPanel.stories.tsx` — representative empty, active, done, and TBD states.
- `src/components/activity/activity-model.ts` — event-store snapshot to Activity entry projection.
- `src/components/activity/activity-model.test.ts` — projection and filter tests.
- `src/components/activity/ActivityCenter.tsx` — Activity page and filters.
- `src/components/activity/ActivityRow.tsx` — individual Activity presentation.
- `src/components/activity/ActivityCenter.ui.test.tsx` — page behavior tests.
- `src/components/approvals/PendingRequestsSection.tsx` — reusable pending-request list extracted from Approval Center.
- `src/components/visualize/visualize-reference.ts` — parser and type guard for Codex-style references.
- `src/components/visualize/visualize-reference.test.ts` — parser tests.
- `src/components/visualize/VisualizeFrame.tsx` — safe iframe wrapper and load/error states.
- `src/components/visualize/VisualizeFrame.test.tsx` — frame security and loader tests.
- `src/components/conversation/MessageContent.tsx` — Markdown plus Visualize segment renderer.
- `.agents/skills/visualize/SKILL.md` — Ruxex Visualize skill contract.

### New Rust files

- `src-tauri/src/visualization.rs` — validated `.html` reader and unit tests for path/size/extension checks.

## Task 1: Add child-thread query and subagent projection

**Files:**
- Modify: `src/app-server/query-keys.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Create: `src/components/thread-summary/subagent-model.ts`
- Test: `src/components/thread-summary/subagent-model.test.ts`
- Test: `src/app-server/hooks/useThreadQueries.test.tsx`

**Interfaces:**
- `useSubagentThreadList(parentThreadId: string)` returns the existing `useThreadList` result with `{ parentThreadId, archived: false, limit: 100, sortKey: "updated_at", sortDirection: "desc" }`.
- `SubagentRow` is `{ threadId: string; label: string; role: string | null; task: string; status: "active" | "done" | "failed" | "interrupted"; summary: string | null; updatedAt: number; waitingForApproval: boolean }`.
- `buildSubagentRows(threads: v2.Thread[], liveThreads: Record<string, ThreadExecutionState>, pendingRequests: PendingServerRequest[]): SubagentRow[]` returns newest-updated rows first and falls back to `Agent <short-id>` when nickname and role are absent.

- [ ] **Step 1: Write failing query-hook tests**

  Add a test that renders `useSubagentThreadList("parent-1")` and asserts the AppServer request receives the fixed parent filter and query key is scoped to that parent.

- [ ] **Step 2: Run the focused query tests**

  Run: `pnpm vitest run src/app-server/hooks/useThreadQueries.test.tsx`

  Expected: FAIL because the child-thread hook and query key do not exist.

- [ ] **Step 3: Implement `useSubagentThreadList` and its query key**

  Keep the generic `useThreadList` unchanged; add a small wrapper so callers cannot accidentally omit `parentThreadId`.

- [ ] **Step 4: Write failing subagent model tests**

  Cover active, completed, failed, interrupted, missing nickname/role, and pending-request states. Assert that live execution state overrides stale persisted status and that task text falls back to `thread.preview`.

- [ ] **Step 5: Run the model tests to verify failure**

  Run: `pnpm vitest run src/components/thread-summary/subagent-model.test.ts`

  Expected: FAIL because the projection module does not exist.

- [ ] **Step 6: Implement `buildSubagentRows`**

  Map existing protocol values only; do not invent a new AppServer status or mutate generated protocol types.

- [ ] **Step 7: Run focused tests and typecheck**

  Run: `pnpm vitest run src/app-server/hooks/useThreadQueries.test.tsx src/components/thread-summary/subagent-model.test.ts && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add src/app-server/query-keys.ts src/app-server/hooks/useThreadQueries.ts src/app-server/hooks/useThreadQueries.test.tsx src/components/thread-summary/subagent-model.ts src/components/thread-summary/subagent-model.test.ts
  git commit -m "feat: add subagent thread projection"
  ```

## Task 2: Build the Thread Summary Panel and Subagents section

**Files:**
- Create: `src/components/thread-summary/ThreadSummaryPanel.tsx`
- Create: `src/components/thread-summary/SubagentsSection.tsx`
- Create: `src/components/thread-summary/SubagentDetail.tsx`
- Create: `src/components/thread-summary/ThreadSummaryPanel.test.tsx`
- Create: `src/components/thread-summary/ThreadSummaryPanel.stories.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`

**Interfaces:**
- `ThreadSummaryPanel({ threadId, open, onClose }: { threadId: string; open: boolean; onClose: () => void })` renders the five sections in the fixed order.
- `SubagentsSection({ parentThreadId, selectedThreadId, onSelect }: { parentThreadId: string; selectedThreadId: string | null; onSelect: (threadId: string) => void })` renders Active and Done groups.
- `SubagentDetail({ threadId, onBack }: { threadId: string; onBack: () => void })` loads the child conversation through existing conversation hooks and renders the existing conversation item components.

- [ ] **Step 1: Write failing panel tests**

  Assert that the panel is closed by default, opens from a labeled Summary button, shows all five section labels, shows `TBD` in the four unimplemented sections, and closes without changing the parent conversation.

- [ ] **Step 2: Write failing Subagents interaction tests**

  Provide active and done child-thread fixtures, assert the two groups, click a child row, assert the child detail view and Back action, and assert an empty-state message when there are no child threads.

- [ ] **Step 3: Run focused UI tests to verify failure**

  Run: `pnpm vitest run src/components/thread-summary/ThreadSummaryPanel.test.tsx`

  Expected: FAIL because the panel components do not exist.

- [ ] **Step 4: Implement the panel shell and TBD sections**

  Add the Summary trigger to `ConversationWorkspace` without replacing the existing conversation timeline or composer. Use the current layout primitives and ensure the panel is a sibling of the main chat column.

- [ ] **Step 5: Implement Active/Done child lists**

  Use Task 1's hook and projection. Keep selection local to the panel; do not change the URL for the first version.

- [ ] **Step 6: Implement child detail view**

  Reuse existing thread conversation loading and conversation rendering. Add a clear Back control and preserve the parent panel scroll position when returning.

- [ ] **Step 7: Add stories and run tests**

  Run: `pnpm vitest run src/components/thread-summary/ThreadSummaryPanel.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/thread-summary src/components/conversation/ConversationWorkspace.tsx
  git commit -m "feat: add thread summary subagents panel"
  ```

## Task 3: Extract Approval Center primitives and add Activity Center

**Files:**
- Create: `src/components/approvals/PendingRequestsSection.tsx`
- Modify: `src/components/approvals/ApprovalCenter.tsx`
- Create: `src/components/activity/activity-model.ts`
- Create: `src/components/activity/activity-model.test.ts`
- Create: `src/components/activity/ActivityCenter.tsx`
- Create: `src/components/activity/ActivityRow.tsx`
- Create: `src/components/activity/ActivityCenter.ui.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- `PendingRequestsSection({ connected, pendingRequests }: { connected: boolean; pendingRequests: PendingServerRequest[] })` owns the existing `ServerRequestCard` mapping and resolution callbacks.
- `ActivityFilter = "all" | "needsAction" | "running" | "agents" | "completed"`.
- `ActivityEntry` is `{ id: string; kind: "approval" | "agent" | "thread" | "tool"; title: string; detail: string; threadId: string | null; status: string; timestamp: number; needsAction: boolean }`.
- `buildActivityEntries(snapshot: EventState, threads: v2.Thread[]): ActivityEntry[]` returns newest first and includes child-thread activity.

- [ ] **Step 1: Extract the pending-request section without changing Approval Center behavior**

  Move the existing pending list and callbacks into `PendingRequestsSection`; keep the current `/approvals` page copy and disconnected state unchanged.

- [ ] **Step 2: Run existing approval tests**

  Run: `pnpm vitest run src/components/approvals/ApprovalCenter.ui.test.tsx src/components/approvals/ServerRequestCard.test.tsx`

  Expected: PASS.

- [ ] **Step 3: Write failing Activity model tests**

  Cover filters, pending requests, running threads, agent lifecycle events, completed events, child thread links, newest-first ordering, and empty history.

- [ ] **Step 4: Run model tests to verify failure**

  Run: `pnpm vitest run src/components/activity/activity-model.test.ts`

  Expected: FAIL because the Activity model does not exist.

- [ ] **Step 5: Implement `buildActivityEntries`**

  Project the existing event-store snapshot only. Do not expand `MAX_HISTORY` or add persistence in this milestone.

- [ ] **Step 6: Write failing Activity Center UI tests**

  Assert filter tabs, empty state, pending approval rendering, Agent event rendering, and links/actions for the source thread and approval card.

- [ ] **Step 7: Implement Activity Center and `/activity` route**

  Render `PendingRequestsSection` for `Needs action`; render `ActivityRow` for other filters. Keep `/approvals` as the dedicated approval page.

- [ ] **Step 8: Run focused tests and typecheck**

  Run: `pnpm vitest run src/components/approvals src/components/activity && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/approvals src/components/activity src/app/router.tsx
  git commit -m "feat: add activity center from app server events"
  ```

## Task 4: Add the Ruxex Visualize skill and safe reference renderer

**Files:**
- Create: `.agents/skills/visualize/SKILL.md`
- Create: `src/components/visualize/visualize-reference.ts`
- Create: `src/components/visualize/visualize-reference.test.ts`
- Create: `src/components/visualize/VisualizeFrame.tsx`
- Create: `src/components/visualize/VisualizeFrame.test.tsx`
- Create: `src/components/conversation/MessageContent.tsx`
- Modify: `src/components/conversation/ConversationItem.tsx`

**Interfaces:**
- `VisualizeReference` is `{ path: string; mode: "regular" | "wide" }`.
- `parseVisualizeReferences(text: string): MessageSegment[]` recognizes only the Codex-style `visualize{...}` token and preserves surrounding Markdown.
- `MessageSegment` is either `{ type: "markdown"; text: string }` or `{ type: "visualize"; reference: VisualizeReference }`.
- `VisualizeFrame({ reference, loadHtml }: { reference: VisualizeReference; loadHtml?: (path: string) => Promise<string> })` renders a sandboxed iframe and exposes loading/error states.
- The skill instructs the model to create a self-contained HTML fragment file, emit the visualize reference, avoid `window.openai`, avoid OpenAI-hosted runtimes, avoid network APIs, and keep output below 1 MiB.

- [ ] **Step 1: Write failing reference parser tests**

  Cover a valid regular reference, a valid wide reference, invalid JSON, missing path, unknown mode, multiple references, and ordinary Markdown containing no reference.

- [ ] **Step 2: Run parser tests to verify failure**

  Run: `pnpm vitest run src/components/visualize/visualize-reference.test.ts`

  Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement the parser**

  Parse only the exact marker shape, default missing mode to `regular`, reject non-string paths and unknown modes, and never interpret arbitrary HTML in the message text.

- [ ] **Step 4: Write failing VisualizeFrame tests**

  Assert loading, successful `srcDoc` rendering, `sandbox="allow-scripts"`, no `allow-same-origin`, wide class application, loader failure, and oversized HTML rejection.

- [ ] **Step 5: Implement the sandbox wrapper**

  Build a complete `srcDoc` around the returned fragment with a restrictive CSP: inline scripts/styles allowed for the visual, `img-src` limited to `data:`/`blob:`, `connect-src 'none'`, and no frame/object/form navigation. Do not inject any `window.openai` bridge.

- [ ] **Step 6: Add `MessageContent` and integrate AgentMessage rendering**

  Replace the direct `MarkdownContent` call in `ConversationItem` with `MessageContent`. Render Markdown segments normally and Visualize segments through `VisualizeFrame`; retain ordinary code blocks unchanged.

- [ ] **Step 7: Add the repository Visualize skill**

  Create the skill with the Codex-compatible file/reference contract and Ruxex-specific exclusions. Do not copy OpenAI-hosted chart imports, widget-state APIs, or follow-up APIs.

- [ ] **Step 8: Run focused tests and typecheck**

  Run: `pnpm vitest run src/components/visualize src/components/conversation/ConversationItem* && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 9: Commit**

  ```bash
  git add .agents/skills/visualize src/components/visualize src/components/conversation/MessageContent.tsx src/components/conversation/ConversationItem.tsx
  git commit -m "feat: add sandboxed visualize references"
  ```

## Task 5: Add the validated Tauri HTML reader

**Files:**
- Create: `src-tauri/src/visualization.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/platform/native.ts`
- Test: `src/platform/native.test.ts`

**Interfaces:**
- TypeScript `readVisualizationFile(path: string): Promise<string>` invokes `read_visualization_file`.
- Rust `read_visualization_file(path: String) -> CommandResult<String>` accepts only absolute regular `.html` files under the existing Ruxex home, user home, or workspace roots.
- Rust limit: `MAX_VISUALIZATION_BYTES = 1_048_576` bytes.

- [ ] **Step 1: Write failing TypeScript bridge tests**

  Assert the exact invoke call and returned HTML string for `readVisualizationFile`.

- [ ] **Step 2: Run the bridge test to verify failure**

  Run: `pnpm vitest run src/platform/native.test.ts`

  Expected: FAIL because the bridge function does not exist.

- [ ] **Step 3: Implement the TypeScript bridge**

  Follow the existing `readImageFile` and artifact bridge patterns; do not expose a generic filesystem read API.

- [ ] **Step 4: Add Rust validation tests**

  Cover non-absolute paths, non-HTML extensions, symlinks, directories, files outside permitted roots, files over 1 MiB, and valid HTML files.

- [ ] **Step 5: Implement `read_visualization_file`**

  Canonicalize the path, reject symlinks and non-regular files, validate the extension and root, enforce the byte limit, then return UTF-8 HTML content. Reuse the existing root validation style from artifact and image readers.

- [ ] **Step 6: Register the command**

  Add the module and command to `src-tauri/src/lib.rs` without changing AppServer registration.

- [ ] **Step 7: Connect VisualizeFrame to the native reader**

  Pass `readVisualizationFile` as the production loader while keeping the injected loader for browser tests and stories.

- [ ] **Step 8: Run web and Rust verification**

  Run: `pnpm vitest run src/platform/native.test.ts src/components/visualize && pnpm typecheck && cargo test --manifest-path src-tauri/Cargo.toml visualization`

  Expected: PASS.

- [ ] **Step 9: Commit**

  ```bash
  git add src/platform/native.ts src/platform/native.test.ts src-tauri/src/visualization.rs src-tauri/src/lib.rs src/components/visualize
  git commit -m "feat: safely load local visualize html"
  ```

## Task 6: Whole-feature verification and handoff

**Files:**
- Modify only if verification exposes an integration defect.

- [ ] **Step 1: Run the complete web test suite**

  Run: `pnpm test`

  Expected: PASS.

- [ ] **Step 2: Run typecheck, lint, and production build**

  Run: `pnpm typecheck && pnpm lint && pnpm build`

  Expected: PASS with no new warnings.

- [ ] **Step 3: Run Rust tests and formatting check**

  Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check && cargo test --manifest-path src-tauri/Cargo.toml`

  Expected: PASS.

- [ ] **Step 4: Run the relevant Ladle/catalog checks**

  Run: `pnpm check:catalog`

  Expected: PASS, with stories present for Thread Summary, Activity Center, and VisualizeFrame.

- [ ] **Step 5: Manually verify the desktop flow**

  Verify: open Summary, inspect Active/Done child agents, open a child thread, see TBD sections, open Activity, resolve a pending approval, render a local Visualize HTML file, and confirm a path-outside-root error is shown without executing in the parent page.

- [ ] **Step 6: Review the final diff**

  Run: `git diff --check && git status --short`

  Confirm unrelated user changes remain untouched and no generated protocol/AppServer files were modified.

