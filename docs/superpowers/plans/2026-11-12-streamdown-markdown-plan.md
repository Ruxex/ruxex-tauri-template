# Streamdown Markdown Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the custom Markdown renderer with Vercel Streamdown so streaming Markdown can animate without detecting appended text in the frontend.

**Architecture:** `MessageContent` remains the boundary that splits Visualize references from Markdown. A new `MarkdownContent` wrapper delegates Markdown rendering to `Streamdown`, passing animation state only when the caller identifies an active stream. Existing non-chat callers keep static rendering.

**Tech Stack:** React 19, TypeScript, Vercel `streamdown`, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-streamdown-markdown-design.md`

## Global Constraints

- Do not track or diff accumulated delta text in the frontend.
- Preserve `VisualizeFrame` rendering and selectable chat content.
- Use the repository Makefile for verification.

## Review Focus

- Incomplete emphasis, links, and fenced code during streaming remain valid rendered Markdown.
- Completed static Markdown still supports headings, lists, code, links, tables, and diff blocks.
- Visualize references remain separate from Markdown rendering.
- Streamdown styles are included in the Tailwind build.
- Static command/activity callers do not animate their content.

### Task 1: Install and configure Streamdown

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/styles/index.css`

- [ ] Add the current Streamdown dependency and its Tailwind `@source` directive.
- [ ] Run the package installation and verify the lockfile resolves React 19-compatible peers.

### Task 2: Replace the Markdown renderer

**Files:**
- Modify: `src/components/conversation/MarkdownContent.tsx`
- Modify: `src/components/conversation/MessageContent.tsx`
- Modify: `src/components/conversation/ConversationItem.tsx`
- Test: `src/components/conversation/MarkdownContent.test.tsx`
- Test: `src/components/conversation/MessageContent.test.tsx`

- [ ] Add failing tests for Streamdown rendering and active streaming animation props.
- [ ] Pass an `isAnimating` prop from streamed assistant messages into `MarkdownContent`.
- [ ] Delegate Markdown parsing and animation to Streamdown while preserving Visualize segmentation.
- [ ] Keep static callers unchanged by defaulting animation off.

### Task 3: Verify the application

- [ ] Run focused conversation tests and confirm they fail before implementation and pass after it.
- [ ] Run `make verify` and `git diff --check`.
