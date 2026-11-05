# Global Scrollbar Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply a consistent thin, subtle scrollbar design throughout the app.

**Architecture:** Add one global scrollbar rule block to the existing stylesheet. Use standards-based properties for Firefox and WebKit pseudo-elements for exact 6px sizing and rounded visuals in Chromium-based environments.

**Tech Stack:** Tailwind CSS 4.3.3, CSS, Vite/Tauri.

**Spec:** `docs/superpowers/specs/2026-11-05-global-scrollbar-design.md`

## Global Constraints

- Do not add dependencies or modify component overflow behavior.
- Preserve unrelated working-tree changes.
- Apply the design globally from `src/styles/index.css`.

## Review Focus

- Firefox/standards-based rendering uses a thin scrollbar and transparent track.
- Chromium/WebKit rendering uses a 6px scrollbar and rounded thumb.
- Hovering the thumb increases contrast without making the track visible.
- The rule does not hide scrolling or alter layout dimensions beyond scrollbar styling.

### Task 1: Add global scrollbar styles

**Files:**
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: Existing global stylesheet and color system.
- Produces: Global scrollbar styling for all elements.

- [ ] Add a global `*` block with `scrollbar-width: thin` and a subtle thumb/transparent track color.
- [ ] Add `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, and `::-webkit-scrollbar-thumb` rules using 6px dimensions, transparent track, rounded thumb, and a hover state.
- [ ] Run `pnpm build` from `ruxex-tauri-template` and confirm it exits successfully.
- [ ] Review `git diff -- src/styles/index.css` and confirm only the intended stylesheet block changed.
