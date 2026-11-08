# Story UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the selected high-priority UI states and make the Ladle catalog cover the remaining interaction and visual states without changing excluded typography, project metadata controls, or message-action behavior.

**Architecture:** Keep the existing React component boundaries, DaisyUI/Tailwind styling, and current server-backed behavior. Make presentation-only changes in the owning components, reuse existing `EmptyState`/`StateBadge` primitives, and extend colocated Ladle stories plus component tests for each changed behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, DaisyUI 5, Ladle, Vitest, Testing Library.

**Spec:** User-selected scope in the conversation on 2026-11-08.

## Global Constraints

- Do not change the project icon/color selector UI.
- Do not change conversation body typography or message-action visibility.
- Remove the children-only legacy `EmptyState` rendering because production callers use the structured API; retain the structured API.
- Preserve App Server protocol semantics and existing permission response behavior.
- Preserve unrelated user changes, including the untracked artifact compatibility design document.

## Review Focus

- Permission requests must summarize requested access before approval — tests in `ServerRequestCard.test.tsx`.
- Permission summaries must handle network-only, filesystem-only, and mixed requests — tests in `ServerRequestCard.test.tsx`.
- Composer mode indicators must remain understandable when disabled or when an active turn is present — tests in `ComposerOptions.test.tsx` and `Composer.test.tsx`.
- Empty sidebar states must use the structured visual treatment without changing loading/error behavior — tests in `AsyncState.test.tsx` and relevant sidebar tests.
- Stories must render real multiline command output and representative populated/empty/error states — Ladle build/catalog check.

### Task 1: Permission request summary

**Files:**
- Modify: `src/components/approvals/ServerRequestCard.tsx`
- Test: `src/components/approvals/ServerRequestCard.test.tsx`
- Story: `src/components/approvals/ServerRequestCard.stories.tsx`

- [x] Add a failing test asserting that a permission request shows a concise access summary while retaining `Requested access` and `Request details` disclosures.
- [x] Add a small presentation helper in `ServerRequestCard.tsx` that summarizes network and filesystem permissions without changing the response payload.
- [x] Render the summary by default and reduce the request-id badge prominence.
- [x] Run the focused approval tests and the full test suite.

### Task 2: Composer state clarity

**Files:**
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/ComposerOptions.tsx`
- Modify: `src/components/conversation/ComposerSettings.tsx`
- Test: `src/components/conversation/Composer.test.tsx`
- Test: `src/components/conversation/ComposerOptions.test.tsx`
- Story: `src/components/conversation/Composer.stories.tsx`
- Story: `src/components/conversation/ComposerOptions.stories.tsx`

- [x] Add failing tests for visible Goal/Plan indicators and consistent disabled treatment of the submission-mode control.
- [x] Render compact active-mode indicators in the composer while keeping the existing menu actions.
- [x] Make unavailable model/effort state visually neutral and make the split submission control appear disabled as one control.
- [x] Run focused composer tests and the full test suite.

### Task 3: Sidebar hierarchy and empty states

**Files:**
- Modify: `src/components/common/AsyncState.tsx`
- Modify: `src/components/common/AsyncState.stories.tsx`
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/components/chats/ChatSidebarSections.tsx`
- Modify: `src/components/chats/ChatListItem.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Test: existing sidebar/common tests, adding focused assertions where needed

- [x] Add failing tests for structured empty chat/project states and a single selected-row treatment.
- [x] Remove the children-only fallback in `EmptyState` and delete the `EmptyLegacy` story; keep all structured empty-state callers.
- [x] Replace sparse sidebar empty text with the shared structured state, improve section-label contrast, and simplify selected chat styling.
- [x] Run focused sidebar/common tests and the full test suite.

### Task 4: MCP status presentation

**Files:**
- Modify: `src/components/mcp/McpStatusSummary.tsx`
- Test: `src/components/mcp/McpStatusSummary.test.tsx`
- Story: `src/components/mcp/McpStatusSummary.stories.tsx`

- [x] Add failing tests for separate, scannable connection and authentication status groups.
- [x] Present the two statuses as compact labeled rows/badges with existing tone mapping and wording.
- [x] Add a story covering the unavailable and failed states in the revised layout.
- [x] Run focused MCP tests and the full test suite.

### Task 5: Story coverage and catalog quality

**Files:**
- Modify: `.ladle/support/catalog-providers.tsx`
- Modify: `.ladle/support/catalog-providers.tsx` or a new shared catalog surface helper if required
- Modify: `src/components/approvals/ApprovalCenter.stories.tsx`
- Modify: `src/components/chats/ChatSearchDialog.stories.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.stories.tsx`
- Modify: `src/components/conversation/CommandExecutionView.stories.tsx`
- Modify: `src/components/conversation/ActivityItem.stories.tsx`
- Modify: `src/components/conversation/QueuedMessages.stories.tsx`
- Modify: `src/components/projects/NewProjectDialog.stories.tsx`
- Modify: `src/components/conversation/ComposerSettings.stories.tsx`
- Modify: `src/components/sidebar/ThreadList.stories.tsx`

- [x] Add representative populated, error, loading, and interaction stories for the currently sparse catalog entries.
- [x] Fix command output stories to pass actual multiline text.
- [x] Add shared catalog viewport/surface guidance where it improves comparison, without changing product runtime styles.
- [x] Run `pnpm check:catalog`, `pnpm ladle:build`, and the full test suite.

### Task 6: Verification

**Files:**
- No source changes expected.

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm check:catalog` and `pnpm ladle:build`.
- [x] Run `git diff --check` and inspect the final diff, preserving unrelated changes.
