# Complete Ladle Component Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register every non-test React component file under `src/components` in the Ladle catalog with at least one deterministic story.

**Architecture:** Add one colocated `*.stories.tsx` module for each component source file. Stories for pure components use inline deterministic props; components that require routing, query state, application state, or callbacks use catalog-only providers and no-op fixtures under `.ladle/`. A small coverage checker verifies that every component source file has a matching story module.

**Tech Stack:** React 19, TypeScript, Ladle 5.1, React Router, Tailwind CSS 4, DaisyUI 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-ladle-component-catalog-design.md`

## Global Constraints

- Every non-test `src/components/**/*.tsx` file has a colocated `*.stories.tsx` file.
- Every exported React component in a multi-export source file has at least one named Story.
- Stories must not connect to a real App Server, database, credential store, or network.
- Page and layout containers use the smallest deterministic harness needed to render them.
- Preserve the existing five story modules and their representative states.
- Keep catalog-only helpers under `.ladle/`; do not add catalog-only runtime code under `src/components`.

## Review Focus

- A source file with multiple exported components, especially `SettingsCards.tsx`, exposes a Story for every exported component.
- Components using `useNavigate`, `Link`, or location state render under the shared `MemoryRouter`.
- Components using App Server/query hooks render with deterministic local providers or safe no-op adapters.
- Interactive controls do not trigger real mutations, Tauri commands, network requests, or persistent writes.
- The catalog build emits the Tailwind classes used by stories and includes every story module.

## File Map

- Modify: `package.json` to add the catalog coverage command.
- Create: `scripts/check-ladle-component-stories.mjs` to validate source/story pairing.
- Create or modify: `.ladle/support/*` for shared router, query, callback, and deterministic data helpers.
- Create: colocated stories for all currently unregistered component files in the following groups:
  - `approvals`, `capabilities`, `chat`, `chats`
  - `common`, `conversation`, `layout`, `mcp`, `plugins`
  - `projects`, `quick-panel`, `settings`, `sidebar`
- Modify: `docs/superpowers/specs/2026-11-08-ladle-component-catalog-design.md` only if implementation details clarify the approved boundary.

### Task 1: Add coverage guard and catalog support

**Files:**

- Create: `scripts/check-ladle-component-stories.mjs`
- Modify: `package.json`
- Create: `.ladle/support/catalog-data.ts`
- Create: `.ladle/support/catalog-providers.tsx`

- [x] Write a coverage test/command that recursively finds non-test `src/components/**/*.tsx` files, excludes existing `*.stories.tsx`, and requires the matching `.stories.tsx` path.
- [x] Make the command report every missing pair and exit non-zero when any are missing.
- [x] Add `check:catalog` to `package.json`.
- [x] Add shared deterministic data and no-op callbacks for thread, project, approval, MCP, plugin, and conversation stories.
- [x] Add provider helpers for `MemoryRouter` and any required query/app-state context without invoking production services.
- [x] Run the coverage command and confirm it fails before the new story modules exist.

### Task 2: Add common, layout, project, plugin, MCP, and capability stories

**Files:**

- Create: `src/components/capabilities/BrowserComputerUseCard.stories.tsx`
- Create: `src/components/common/AttachmentPreview.stories.tsx`
- Create: `src/components/common/CapabilityStatus.stories.tsx`
- Create: `src/components/common/DialogParts.stories.tsx`
- Create: `src/components/common/ThreadCard.stories.tsx`
- Create: `src/components/layout/AppLayout.stories.tsx`
- Create: `src/components/layout/BrowserNavigationBar.stories.tsx`
- Create: `src/components/layout/PageContainer.stories.tsx`
- Create: `src/components/mcp/McpResourceViewer.stories.tsx`
- Create: `src/components/plugins/MarketplaceAssetImage.stories.tsx`
- Create: `src/components/projects/NewProjectDialog.stories.tsx`
- Create: `src/components/projects/ProjectIcon.stories.tsx`
- Create: `src/components/projects/ProjectMetadataFields.stories.tsx`
- Create: `src/components/projects/WorktreeCard.stories.tsx`

- [x] Add deterministic states for loading/error/status, selected/empty/populated, and disabled/interactive variants where the component exposes them.
- [x] Use local callbacks for dialogs and actions; stories must remain clickable without writing data.
- [x] Add `McpResourceViewer` stories for text, blob, loading, and unavailable resource states using local values.
- [x] Add marketplace image states without fetching a remote image; use the existing fallback policy or a local data URL.
- [x] Render `AppLayout` with a minimal MemoryRouter/provider harness and no application server.
- [x] Run `pnpm typecheck`, `pnpm exec ladle build`, and the coverage command.

### Task 3: Add chat and composer stories

**Files:**

- Create: `src/components/chat/NewChatComposer.stories.tsx`
- Create: `src/components/chats/ChatActivityTimeline.stories.tsx`
- Create: `src/components/chats/ChatSearchDialog.stories.tsx`
- Create: `src/components/chats/ChatSidebarSections.stories.tsx`
- Create: `src/components/chats/ChatStatusIcon.stories.tsx`
- Create: `src/components/chats/ProjectSelector.stories.tsx`

- [x] Cover empty, selected, unread, waiting, failed, and populated chat/navigation states.
- [x] Use deterministic thread/project data and local no-op archive/select/search callbacks.
- [x] Render search and selector dialogs with explicit open state and no external query.
- [x] Exercise activity timeline entries with working, completed, failed, and approval-related items.
- [x] Run `pnpm typecheck`, `pnpm exec ladle build`, and the coverage command.

### Task 4: Add conversation stories

**Files:**

- Create: `src/components/conversation/ActivityItem.stories.tsx`
- Create: `src/components/conversation/CommandExecutionView.stories.tsx`
- Create: `src/components/conversation/Composer.stories.tsx`
- Create: `src/components/conversation/ComposerOptions.stories.tsx`
- Create: `src/components/conversation/ComposerSettings.stories.tsx`
- Create: `src/components/conversation/ConversationItem.stories.tsx`
- Create: `src/components/conversation/ConversationWorkspace.stories.tsx`
- Create: `src/components/conversation/ImageView.stories.tsx`
- Create: `src/components/conversation/MarkdownContent.stories.tsx`
- Create: `src/components/conversation/QueuedMessages.stories.tsx`
- Create: `src/components/conversation/SlashCommandPalette.stories.tsx`

- [x] Cover message text, markdown/code, images, command execution, queued messages, and failure states with local data.
- [x] Cover composer disabled/enabled, attachment, permission, submission-mode, and slash-command states without sending anything.
- [x] Render `ConversationWorkspace` and `ConversationItem` through deterministic catalog adapters rather than a live thread or App Server.
- [x] Add local providers or mocks only where the component requires application context; keep production imports unchanged.
- [x] Run `pnpm typecheck`, `pnpm exec ladle build`, and the coverage command.

### Task 5: Add settings, sidebar, approval, and page-container stories

**Files:**

- Create: `src/components/approvals/ApprovalCenter.stories.tsx`
- Create: `src/components/settings/SettingsCards.stories.tsx`
- Create: `src/components/quick-panel/QuickPanelPage.stories.tsx`
- Create: `src/components/sidebar/HomeSidebar.stories.tsx`
- Create: `src/components/sidebar/PluginsSidebar.stories.tsx`
- Create: `src/components/sidebar/ProjectSidebar.stories.tsx`
- Create: `src/components/sidebar/RouteSidebar.stories.tsx`
- Create: `src/components/sidebar/SettingsSidebar.stories.tsx`
- Create: `src/components/sidebar/SidebarHeader.stories.tsx`
- Create: `src/components/sidebar/ThreadList.stories.tsx`

- [x] Add named stories for every exported component in `SettingsCards.tsx`.
- [x] Cover settings cards in default, configured, disabled, and error/empty variants where props permit it.
- [x] Cover sidebar expanded/collapsed, selected route, unread threads, project, plugin, and settings navigation states.
- [x] Render approval and quick-panel containers with deterministic pending data and safe no-op actions.
- [x] Keep app-level adapters catalog-only and avoid adding production state just to satisfy the stories.
- [x] Run `pnpm typecheck`, `pnpm exec ladle build`, and the coverage command.

### Task 6: Full verification and catalog review

- [x] Run `pnpm check:catalog` and confirm all component source files have colocated stories.
- [x] Run `pnpm ladle:build` and confirm all story modules are included and no Tailwind utility classes are missing.
- [x] Run `make check-tests`.
- [x] Run `git diff --check` and inspect the catalog in the Ladle dev server.
- [x] Verify no screenshots, generated `build/` output, credentials, or external network fixtures are tracked.
