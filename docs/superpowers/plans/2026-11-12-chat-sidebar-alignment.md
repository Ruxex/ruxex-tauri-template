# Chat Sidebar Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align project disclosure chevrons and make project chat rows match recent-chat rows.

**Architecture:** Preserve `ChatSidebarSections`, `ThreadList`, and `ChatListItem`; change only sidebar utility classes and add focused DOM regression assertions.

**Tech Stack:** React, TypeScript, Tailwind/DaisyUI utility classes, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-chat-sidebar-alignment-design.md`

## Global Constraints

- Preserve existing project expansion, chat navigation, archive, and loading behavior.
- Do not change app-server query contracts or data models.

## Review Focus

- Project disclosure chevron alignment: test the project button and section summary share the same horizontal padding basis.
- Project chat row nesting: test project chats use the same direct `ChatListItem` row shape and no extra button wrapper.
- Multiple expanded projects: retain the existing independent expansion test.

### Task 1: Sidebar layout regression and fix

**Files:**
- Modify: `src/components/chats/ChatSidebarSections.test.tsx`
- Modify: `src/components/chats/ChatSidebarSections.tsx`

- [ ] Add failing assertions for aligned project disclosure padding and project chat row structure.
- [ ] Run the focused test and confirm it fails for the current markup/classes.
- [ ] Apply the minimal class/markup change in `ChatSidebarSections.tsx`.
- [ ] Run the focused test and confirm it passes.
- [ ] Run the full test suite and typecheck.
