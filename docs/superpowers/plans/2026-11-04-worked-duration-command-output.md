# Worked Duration and Command Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Keep the chat turn duration visible after completion and constrain large command results to a scrollable panel.

**Architecture:** Reuse the protocol `Turn` timestamps and `durationMs` already available in `ConversationWorkspace`; keep duration formatting and placement in `ChatActivityTimeline`. Apply the output constraint locally to `CommandExecutionView` without changing protocol or stored data.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tailwind/DaisyUI.

**Spec:** `docs/superpowers/specs/2026-10-30-working-duration-indicator-design.md`

## Global Constraints

- Running turns display `Working for Ns` and completed turns display `Worked for 4m 2s`-style text.
- Prefer `Turn.durationMs`; fall back to `completedAt - startedAt` when needed.
- Keep approvals and existing timeline ordering unchanged.
- Command result output remains horizontally wrapped/scrollable and gains a maximum height with vertical scrolling.

## Tasks

### Task 1: Completed turn duration summary

- [ ] Add failing timeline tests for completed duration formatting, fallback timestamps, and continued running updates.
- [ ] Run the focused timeline tests and confirm the new assertions fail.
- [ ] Pass completed turn metadata from `ConversationWorkspace` and render a `Worked for …` summary at the completed turn's position.
- [ ] Run focused and full frontend tests.

### Task 2: Scroll large command results

- [ ] Add a failing assertion that the command result region has a max-height and vertical overflow.
- [ ] Run the focused activity test and confirm it fails.
- [ ] Add the result region classes in `CommandExecutionView`.
- [ ] Run focused and full frontend tests.

### Task 3: Verification

- [ ] Run typecheck, ESLint, Vitest, Rust fmt check, and `git diff --check`.
